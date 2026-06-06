import settings from '../settings.js';

export async function addBrowserViewer(bot, count_id) {
    if (settings.render_bot_view) {
        try {
            const prismarineViewer = (await import('prismarine-viewer')).default;
            const vPort = 3000 + count_id;
            prismarineViewer.mineflayer(bot, { port: vPort, firstPerson: true });
            console.log(`[Viewer] Avviato su porta ${vPort}`);
        } catch (e) {
            console.warn(`[Viewer] Impossibile avviare (canvas non compilato?): ${e.message}`);
        }
    }
}