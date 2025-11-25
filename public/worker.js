console.log('[Worker] Worker script loaded and executing...');

self.addEventListener('message', async (event) => {
    const message = event.data;
    console.log('[Worker] Received message:', message.type);

    if (message.type === 'transcribe') {
        try {
            console.log('[Worker] Loading Transformers.js...');
            // Dynamic import to avoid top-level blocking
            const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

            // Skip local model checks
            env.allowLocalModels = false;

            console.log('[Worker] Library loaded. Initializing pipeline...');

            // Define PipelineFactory locally or just use pipeline directly since we are inside async
            // Simple singleton pattern inside the handler scope (or global var)
            if (!self.pipelineInstance) {
                self.pipelineInstance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            self.postMessage({
                                type: 'download',
                                data
                            });
                        }
                    }
                });
            }

            console.log('[Worker] Pipeline ready. Starting transcription...');
            const output = await self.pipelineInstance(message.audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
            });

            console.log('[Worker] Transcription complete:', output);
            self.postMessage({
                type: 'complete',
                data: output
            });
        } catch (error) {
            console.error('[Worker] Error:', error);
            self.postMessage({
                type: 'error',
                data: error.message
            });
        }
    }
});
