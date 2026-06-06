#!/usr/bin/env python3
import json
import random
import threading
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

PORT = 8765

# 6 agenti
agents = {
    "Uno": {"health": 20, "hunger": 18, "position": {"x": 10, "y": 64, "z": 5}, "status": "online", "messages": [], "nearby": []},
    "Due": {"health": 19, "hunger": 17, "position": {"x": 15, "y": 64, "z": 8}, "status": "online", "messages": [], "nearby": []},
    "Tre": {"health": 20, "hunger": 19, "position": {"x": -5, "y": 64, "z": -10}, "status": "online", "messages": [], "nearby": []},
    "Quattro": {"health": 18, "hunger": 15, "position": {"x": 25, "y": 64, "z": 20}, "status": "online", "messages": [], "nearby": []},
    "Cinque": {"health": 20, "hunger": 16, "position": {"x": -15, "y": 64, "z": 12}, "status": "online", "messages": [], "nearby": []},
    "Sei": {"health": 19, "hunger": 18, "position": {"x": 8, "y": 64, "z": -18}, "status": "online", "messages": [], "nearby": []}
}

logs = []

def add_log(agent, action):
    logs.insert(0, {"time": datetime.now().strftime("%H:%M:%S"), "agent": agent, "action": action})
    if len(logs) > 50:
        logs.pop()

def update_agents():
    messages_pool = ["Ciao... chi sei?", "Dove siamo?", "Ho fame...", "C'e' qualcuno?", "Ho paura...", "Che posto e' questo?", "Vedo qualcosa laggiu'", "Aiuto!", "Sto cercando cibo", "E' pericoloso qui?", "Ho trovato dei blocchi strani", "Fa buio...", "Chi sei tu?", "Non ricordo niente...", "Dobbiamo trovare un riparo", "Hai visto qualcuno?", "Ho trovato un animale", "Ho bisogno di aiuto", "Dove sei?", "Mi senti?"]
    while True:
        time.sleep(2)
        
        # Muovi agenti casualmente
        for name, agent in agents.items():
            agent["position"]["x"] += random.randint(-3, 3)
            agent["position"]["z"] += random.randint(-3, 3)
            agent["hunger"] = max(0, agent["hunger"] - 0.15)
        
        # Calcola distanze e aggiorna "nearby"
        for name1, agent1 in agents.items():
            nearby = []
            for name2, agent2 in agents.items():
                if name1 != name2:
                    dist = ((agent1["position"]["x"] - agent2["position"]["x"])**2 + (agent1["position"]["z"] - agent2["position"]["z"])**2)**0.5
                    if dist <= 20:
                        nearby.append({"name": name2, "distance": round(dist, 1)})
            agent1["nearby"] = nearby
        
        # Simula messaggi tra agenti vicini
        if random.random() < 0.4:
            agent_names = list(agents.keys())
            sender = random.choice(agent_names)
            receiver = random.choice(agent_names)
            
            if sender != receiver:
                a1 = agents[sender]
                a2 = agents[receiver]
                dist = ((a1["position"]["x"] - a2["position"]["x"])**2 + (a1["position"]["z"] - a2["position"]["z"])**2)**0.5
                
                if dist <= 20:
                    msg = random.choice(messages_pool)
                    a2["messages"].append({"from": sender, "message": msg, "timestamp": time.time()})
                    if len(a2["messages"]) > 10:
                        a2["messages"].pop(0)
                    add_log(receiver, f"Messaggio da {sender}: '{msg}'")
        
        # Log azioni casuali
        if random.random() < 0.25:
            agent = random.choice(list(agents.keys()))
            actions = ["Sta esplorando l'area", "Sta cercando cibo", "Ha raccolto dei blocchi", "Sta costruendo qualcosa", "Si e' fermato a riposare", "Sta osservando l'ambiente", "Ha trovato un animale", "Sta scavando", "Ha craftato un oggetto", "Si sta nascondendo"]
            add_log(agent, random.choice(actions))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/agents":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            data = []
            for n, a in agents.items():
                data.append({
                    "name": n,
                    "health": round(a["health"], 1),
                    "hunger": round(a["hunger"], 1),
                    "position": a["position"],
                    "status": a["status"],
                    "nearby": a["nearby"],
                    "messages": a["messages"][-5:]
                })
            self.wfile.write(json.dumps(data).encode())
        
        elif self.path == "/api/logs":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(logs[:20]).encode())
        
        elif self.path in ["/", "/index.html"]:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            with open("/mnt/okcomputer/output/mindcraft/public/index.html", "rb") as f:
                self.wfile.write(f.read())
        
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404")
    def log_message(self, *args):
        pass

if __name__ == "__main__":
    threading.Thread(target=update_agents, daemon=True).start()
    add_log("Sistema", "Interfaccia avviata")
    for a in ["Uno", "Due", "Tre", "Quattro", "Cinque", "Sei"]:
        add_log(a, "Si e' svegliato in un luogo sconosciuto")
    print(f"PORT={PORT}", flush=True)
    print(f"🌐 Server con 6 agenti su http://localhost:{PORT}", flush=True)
    HTTPServer(("", PORT), Handler).serve_forever()
