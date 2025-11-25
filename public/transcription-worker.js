// Simple non-module worker
console.log('SIMPLE WORKER STARTED');
self.postMessage({ type: 'log', data: 'Simple worker started execution' });

self.onerror = function (e) {
    self.postMessage({ type: 'error', data: 'Worker error: ' + e.message });
};

try {
    self.postMessage({ type: 'alive' });
} catch (e) {
    console.error('Failed to post alive message', e);
}

self.addEventListener('message', function (e) {
    const data = e.data;
    self.postMessage({ type: 'log', data: 'Worker received: ' + data.type });

    if (data.type === 'transcribe') {
        self.postMessage({ type: 'error', data: 'Transcription temporarily disabled for connectivity test' });
    }
});
