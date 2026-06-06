import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mindcraft from './mindcraft.js';
import { readFileSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { db } from '../db/db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mindserver is:
// - central hub for communication between all agent processes
// - api to control from other languages and remote users 
// - host for webapp

let io;
let server;
const agent_connections = {};
const agent_listeners = [];

const settings_spec = JSON.parse(readFileSync(path.join(__dirname, 'public/settings_spec.json'), 'utf8'));

class AgentConnection {
    constructor(settings, viewer_port) {
        this.socket = null;
        this.settings = settings;
        this.in_game = false;
        this.full_state = null;
        this.viewer_port = viewer_port;
    }
    setSettings(settings) {
        this.settings = settings;
    }
}

export function registerAgent(settings, viewer_port) {
    let agentConnection = new AgentConnection(settings, viewer_port);
    agent_connections[settings.profile.name] = agentConnection;
    // Notifica subito tutti i client connessi così sanno che l'agente esiste
    if (io) agentsStatusUpdate();
}

export function logoutAgent(agentName) {
    if (agent_connections[agentName]) {
        agent_connections[agentName].in_game = false;
        agentsStatusUpdate();
    }
}

// Initialize the server
export function createMindServer(host_public = false, port = 8080) {
    const app = express();
    server = http.createServer(app);
    io = new Server(server);

    // Static files (include il build React: index.html, assets/, ecc.)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const publicDir = path.join(__dirname, 'public');
    app.use(express.static(publicDir));

    // Health check per Railway
    app.get('/health', (_req, res) => res.json({
        status: 'ok',
        agents: Object.keys(agent_connections).length,
        db: db.isConnected() ? 'connected' : 'disconnected'
    }));

    // Storico chat dal DB (ultimi 200 messaggi displayabili)
    app.get('/api/chat-history', async (_req, res) => {
        const rows = await db.getRecentChatMessages(200);
        res.json(rows);
    });

    // Lezioni di auto-miglioramento (self-improvement)
    app.get('/api/lessons', async (_req, res) => {
        const rows = await db.getAllLessons(200);
        res.json(rows);
    });

    // Log azioni recenti
    app.get('/api/actions', async (_req, res) => {
        const rows = await db.getRecentActions(200);
        res.json(rows);
    });

    // Ricerca item Minecraft (usata da dashboard e da !searchItem)
    app.get('/api/items', async (req, res) => {
        const q = (req.query.q || '').trim();
        if (!q) { res.json([]); return; }
        const items = await db.searchItems(q, 20);
        res.json(items);
    });

    // Script iniettato nel viewer per camera in terza persona.
    // THREE è bundlato internamente: non è su window per default.
    // Usiamo tre strategie in parallelo:
    //   1. Object.defineProperty intercetta se il bundle assegna window.THREE
    //   2. Polling su window.THREE come fallback
    //   3. Patch diretta su WebGLRenderingContext per catturare il renderer al primo draw
    const THIRD_PERSON_SCRIPT = `<script>
(function(){
  var applied=false;

  function patch(T){
    if(applied)return;
    if(!T||!T.WebGLRenderer)return;
    applied=true;
    var orig=T.WebGLRenderer.prototype.render;
    T.WebGLRenderer.prototype.render=function(scene,camera){
      if(camera&&camera.isPerspectiveCamera&&camera.fov>30){
        var dir=new T.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir,-4);
        camera.position.y+=2;
      }
      orig.call(this,scene,camera);
    };
    console.log('[3P] terza persona attiva');
  }

  // Strategia 1: intercetta window.THREE quando il bundle lo assegna
  try{
    var _t;
    Object.defineProperty(window,'THREE',{
      configurable:true,
      get:function(){return _t;},
      set:function(v){_t=v;setTimeout(function(){patch(v);},0);}
    });
  }catch(e){}

  // Strategia 2: polling ogni 400ms fino a 10s
  var polls=0;
  var iv=setInterval(function(){
    polls++;
    if(window.THREE){patch(window.THREE);clearInterval(iv);}
    if(applied||polls>25)clearInterval(iv);
  },400);

  // Strategia 3: al primo draw WebGL cerchiamo il renderer nel prototipo
  try{
    var origDraw=WebGLRenderingContext.prototype.drawElements;
    WebGLRenderingContext.prototype.drawElements=function(){
      origDraw.apply(this,arguments);
      if(!applied&&window.THREE){patch(window.THREE);WebGLRenderingContext.prototype.drawElements=origDraw;}
    };
  }catch(e){}
})();
</script>`;

    // Proxy viewer prismarine → porta interna (4 agenti max: 3000-3003)
    const viewerProxies = {};
    for (const vPort of [3000, 3001, 3002, 3003]) {
        const vProxy = createProxyMiddleware({
            target: `http://localhost:${vPort}`,
            changeOrigin: true,
            ws: false,
            selfHandleResponse: true,
            on: {
                proxyRes: (proxyRes, _req, res) => {
                    const ct = proxyRes.headers['content-type'] || '';
                    if (ct.includes('text/html')) {
                        const chunks = [];
                        proxyRes.on('data', c => chunks.push(c));
                        proxyRes.on('end', () => {
                            let html = Buffer.concat(chunks).toString('utf8');
                            html = html.includes('</body>')
                                ? html.replace('</body>', THIRD_PERSON_SCRIPT + '</body>')
                                : html + THIRD_PERSON_SCRIPT;
                            const headers = { ...proxyRes.headers };
                            delete headers['content-length'];
                            headers['content-type'] = 'text/html; charset=utf-8';
                            res.writeHead(proxyRes.statusCode || 200, headers);
                            res.end(html);
                        });
                    } else {
                        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                        proxyRes.pipe(res);
                    }
                },
                error: (_err, _req, res) => {
                    if (res && typeof res.writeHead === 'function') {
                        res.writeHead(503).end('Viewer non disponibile');
                    }
                }
            }
        });
        app.use(`/viewer/${vPort}`, vProxy);
        viewerProxies[vPort] = vProxy;
    }

    // SPA catch-all: qualsiasi route non API/viewer/static → index.html
    // Deve stare DOPO express.static e i proxy del viewer
    app.use((_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

    // WebSocket upgrade routing: instrada al proxy corretto in base al path
    server.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        for (const vPort of [3000, 3001, 3002, 3003]) {
            if (url.startsWith(`/viewer/${vPort}/`)) {
                // Simula lo strip del prefix fatto da express prima di passare al proxy
                req.url = url.slice(`/viewer/${vPort}`.length) || '/';
                viewerProxies[vPort].upgrade(req, socket, head);
                return;
            }
        }
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('Client connected');

        agentsStatusUpdate(socket);

        socket.on('create-agent', async (settings, callback) => {
            console.log('API create agent...');
            for (let key in settings_spec) {
                if (!(key in settings)) {
                    if (settings_spec[key].required) {
                        callback({ success: false, error: `Setting ${key} is required` });
                        return;
                    }
                    else {
                        settings[key] = settings_spec[key].default;
                    }
                }
            }
            for (let key in settings) {
                if (!(key in settings_spec)) {
                    delete settings[key];
                }
            }
            if (settings.profile?.name) {
                if (settings.profile.name in agent_connections) {
                    callback({ success: false, error: 'Agent already exists' });
                    return;
                }
                let returned = await mindcraft.createAgent(settings);
                callback({ success: returned.success, error: returned.error });
                let name = settings.profile.name;
                if (!returned.success && agent_connections[name]) {
                    mindcraft.destroyAgent(name);
                    delete agent_connections[name];
                }
                agentsStatusUpdate();
            }
            else {
                console.error('Agent name is required in profile');
                callback({ success: false, error: 'Agent name is required in profile' });
            }
        });

        socket.on('get-settings', (agentName, callback) => {
            if (agent_connections[agentName]) {
                callback({ settings: agent_connections[agentName].settings });
            } else {
                callback({ error: `Agent '${agentName}' not found.` });
            }
        });

        socket.on('connect-agent-process', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agentsStatusUpdate();
            }
        });

        socket.on('login-agent', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agent_connections[agentName].in_game = true;
                curAgentName = agentName;
                agentsStatusUpdate();
            }
            else {
                console.warn(`Unregistered agent ${agentName} tried to login`);
            }
        });

        socket.on('disconnect', () => {
            if (agent_connections[curAgentName]) {
                console.log(`Agent ${curAgentName} disconnected`);
                agent_connections[curAgentName].in_game = false;
                agent_connections[curAgentName].socket = null;
                agentsStatusUpdate();
            }
            if (agent_listeners.includes(socket)) {
                removeListener(socket);
            }
        });

        socket.on('chat-message', (agentName, json) => {
            if (!agent_connections[agentName]) {
                console.warn(`Agent ${agentName} tried to send a message but is not logged in`);
                return;
            }
            const msgText = json.message || '';
            console.log(`${curAgentName} sending message to ${agentName}: ${msgText}`);
            // Mostra il messaggio nella dashboard come conversazione tra agenti
            if (msgText && !msgText.startsWith('(FROM OTHER BOT)')) {
                io.emit('bot-output', curAgentName, `[→ ${agentName}] ${msgText}`);
            }
            // Salva in DB solo se è testo leggibile (non comandi, non shorthand *...*)
            const isCmd       = msgText.trim().startsWith('!');
            const isShorthand = /^\*[^*]+\*$/.test(msgText.trim());
            const hasText     = msgText.replace(/![\w]+[^]*/g, '').replace(/\*[^*]+\*/g, '').trim().length > 0;
            if (!isCmd && !isShorthand && hasText) {
                db.saveChatMessage(curAgentName, `[→ ${agentName}] ${msgText.trim()}`);
            }
            if (agent_connections[agentName].socket) {
                agent_connections[agentName].socket.emit('chat-message', curAgentName, json);
            } else {
                console.warn(`Agent ${agentName} socket not available, cannot deliver message`);
            }
        });

        socket.on('set-agent-settings', (agentName, settings) => {
            const agent = agent_connections[agentName];
            if (agent) {
                agent.setSettings(settings);
                agent.socket.emit('restart-agent');
            }
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            agent_connections[agentName].socket.emit('restart-agent');
        });

        socket.on('stop-agent', (agentName) => {
            mindcraft.stopAgent(agentName);
        });

        socket.on('start-agent', (agentName) => {
            mindcraft.startAgent(agentName);
        });

        socket.on('destroy-agent', (agentName) => {
            if (agent_connections[agentName]) {
                mindcraft.destroyAgent(agentName);
                delete agent_connections[agentName];
            }
            agentsStatusUpdate();
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
        });

        socket.on('shutdown', () => {
            console.log('Shutting down');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
            // wait 2 seconds
            setTimeout(() => {
                console.log('Exiting MindServer');
                process.exit(0);
            }, 2000);
            
        });

		socket.on('send-message', (agentName, data) => {
			if (!agent_connections[agentName]) {
				console.warn(`Agent ${agentName} not in game, cannot send message via MindServer.`);
				return
			}
			try {
				agent_connections[agentName].socket.emit('send-message', data)
			} catch (error) {
				console.error('Error: ', error);
			}
		});

        socket.on('bot-output', (agentName, message) => {
            io.emit('bot-output', agentName, message);
            // Non salviamo bot-output in chat_messages: sono output di azioni (ex: *used collectBlocks*)
            // Le azioni vengono tracciate in agent_actions da action_manager.js
        });

        socket.on('listen-to-agents', () => {
            addListener(socket);
        });
    });

    let host = host_public ? '0.0.0.0' : 'localhost';
    server.listen(port, host, () => {
        console.log(`MindServer running on port ${port}`);
    });

    return server;
}

function agentsStatusUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    for (let agentName in agent_connections) {
        const conn = agent_connections[agentName];
        agents.push({
            name: agentName, 
            in_game: conn.in_game,
            viewerPort: conn.viewer_port,
            socket_connected: !!conn.socket
        });
    };
    socket.emit('agents-status', agents);
}


let listenerInterval = null;
function addListener(listener_socket) {
    agent_listeners.push(listener_socket);
    if (agent_listeners.length === 1) {
        listenerInterval = setInterval(async () => {
            const states = {};
            for (let agentName in agent_connections) {
                let agent = agent_connections[agentName];
                if (agent.in_game) {
                    try {
                        const state = await new Promise((resolve) => {
                            agent.socket.emit('get-full-state', (s) => resolve(s));
                        });
                        states[agentName] = state;
                    } catch (e) {
                        states[agentName] = { error: String(e) };
                    }
                }
            }
            for (let listener of agent_listeners) {
                listener.emit('state-update', states);
            }
        }, 1000);
    }
}

function removeListener(listener_socket) {
    agent_listeners.splice(agent_listeners.indexOf(listener_socket), 1);
    if (agent_listeners.length === 0) {
        clearInterval(listenerInterval);
        listenerInterval = null;
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const numStateListeners = () => agent_listeners.length;