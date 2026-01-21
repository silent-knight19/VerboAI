const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

class EdgeTTSClient {
  constructor() {
    this.ws = null;
  }

  /**
   * Synthesize text to speech
   * @param {string} text - Text to speak
   * @param {string} voice - Voice name (e.g. 'en-US-AriaNeural')
   * @returns {Promise<Buffer>} - MP3 Audio Buffer
   */
  async synthesize(text, voice) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WSS_URL, {
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
          "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      const requestId = uuidv4();
      const audioChunks = [];

      ws.on('open', () => {
        console.log('🗣️ EdgeTTSClient: Connected to Microsoft Edge TTS');

        // 1. Send Configuration
        const configMsg = {
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: false,
                  wordBoundaryEnabled: false
                },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3"
              }
            }
          }
        };
        
        const configHeader = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`;
        ws.send(configHeader + JSON.stringify(configMsg));

        // 2. Send SSML
        const ssml = `
          <speak version='1.0' xml:lang='en-US'>
            <voice name='${voice}'>
              ${text}
            </voice>
          </speak>
        `.trim();

        const ssmlHeader = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n`;
        ws.send(ssmlHeader + ssml);
      });

      ws.on('message', (data, isBinary) => {
        if (!isBinary) {
          const message = data.toString();
          if (message.includes('Path:turn.end')) {
            // End of stream
            ws.close();
            const resultBuffer = Buffer.concat(audioChunks);
            console.log(`🗣️ EdgeTTSClient: Finished. Total bytes: ${resultBuffer.length}`);
            resolve(resultBuffer);
          }
          return;
        }

        // Handle Binary Audio Data
        const buffer = Buffer.from(data);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        
        if (headerEnd > -1) {
          const header = buffer.slice(0, headerEnd).toString();
          const body = buffer.slice(headerEnd + 4);

          if (header.includes('Path:audio')) {
            audioChunks.push(body);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('❌ EdgeTTSClient: WebSocket Error:', error);
        reject(error);
      });

      ws.on('close', (code, reason) => {
        if (code !== 1000 && code !== 1005) {
          console.warn(`🗣️ EdgeTTSClient: Closed with code ${code}`);
        }
        // If we closed manually after turn.end, this is fine.
        // If closed prematurely without turn.end (audioChunks empty), reject.
        if (audioChunks.length === 0) {
           // reject(new Error(`WebSocket closed without receiving audio (code ${code})`));
           // Actually, sometimes open->close happens fast on error.
        }
      });
    });
  }
}

module.exports = new EdgeTTSClient();
