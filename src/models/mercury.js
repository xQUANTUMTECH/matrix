import OpenAIApi from 'openai';
import { getKey, hasKey } from '../utils/keys.js';
import { strictFormat } from '../utils/text.js';

export class Mercury {
    static prefix = 'mercury';
    constructor(model_name, url, params) {
        this.model_name = model_name;
        this.params = params;
        this.url = url || 'https://api.inceptionlabs.ai/v1';

        let config = {
            baseURL: this.url,
            apiKey: getKey('INCEPTION_API_KEY')
        };

        this.openai = new OpenAIApi(config);
    }

    async sendRequest(turns, systemMessage, stop_seq='***') {
        let messages = strictFormat(turns);
        messages = messages.map(message => {
            message.content += stop_seq;
            return message;
        });
        let model = this.model_name || "mercury-2";

        let res = null;

        try {
            console.log('Awaiting Inception Labs API response from model', model);
            let formattedMessages = [{'role': 'system', 'content': systemMessage}].concat(turns);
            formattedMessages = strictFormat(formattedMessages);
            
            const pack = {
                model: model,
                messages: formattedMessages,
                stop: Array.isArray(stop_seq) ? stop_seq : [stop_seq],
                reasoning_effort: 'medium',
                ...(this.params || {})
            };
            
            let completion = await this.openai.chat.completions.create(pack);
            if (completion.choices[0].finish_reason == 'length')
                throw new Error('Context length exceeded'); 
            console.log('Received.');
            res = completion.choices[0].message.content;
        }
        catch (err) {
            if ((err.message == 'Context length exceeded' || err.code == 'context_length_exceeded') && turns.length > 1) {
                console.log('Context length exceeded, trying again with shorter context.');
                return await this.sendRequest(turns.slice(1), systemMessage, stop_seq);
            } else if (err.code === 'content_filter') {
                console.log('Mercury content_filter: messaggio bloccato, nessuna risposta.');
                res = '*no response*';
            } else {
                console.log(err);
                res = 'My brain disconnected, try again.';
            }
        }
        return res;
    }

    async sendVisionRequest(messages, systemMessage, imageBuffer) {
        // Mercury non supporta nativamente la visione, usiamo il testo
        const textMessages = [...messages];
        textMessages.push({
            role: "user",
            content: `[Vision not supported by Mercury model. User sent an image.]`
        });
        return this.sendRequest(textMessages, systemMessage);
    }

    async embed(text) {
        // Mercury non ha embedding API, restituiamo un array vuoto
        // In produzione, usare un altro modello per embeddings
        console.log('Warning: Mercury does not support embeddings, returning empty array');
        return new Array(1536).fill(0);
    }
}
