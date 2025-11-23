
    const API_URL = 'http://localhost:8000';
    let mediaRecorder = null;
    let audioChunks = [];
    let timerInterval = null;
    let recordingStartTime = 0;
    let visualizerInterval = null;
    let audioContext = null;
    let analyser = null;
    let currentAudioUrl = null;

    const MAX_RECORDING_TIME = 60; // seconds

    const elements = {
    recordBtn: document.getElementById('recordBtn'),
    stopBtn: document.getElementById('stopBtn'),
    status: document.getElementById('status'),
    audioOutput: document.getElementById('audioOutput'),
    srcLang: document.getElementById('srcLang'),
    tgtLang: document.getElementById('tgtLang'),
    srcFlag: document.getElementById('srcFlag'),
    tgtFlag: document.getElementById('tgtFlag'),
    swapBtn: document.getElementById('swapBtn'),
    langWarning: document.getElementById('langWarning'),
    timer: document.getElementById('timer'),
    recordingInfo: document.getElementById('recordingInfo'),
    visualizer: document.getElementById('visualizer'),
    progressBar: document.getElementById('progressBar'),
    downloadBtn: document.getElementById('downloadBtn'),
    originalText: document.getElementById('originalText'),
    translatedText: document.getElementById('translatedText'),
    transcriptionSection: document.getElementById('transcriptionSection')
};

    // Update flag icons
    function updateFlags() {
    const srcOption = elements.srcLang.selectedOptions[0];
    const tgtOption = elements.tgtLang.selectedOptions[0];
    elements.srcFlag.textContent = srcOption.dataset.flag;
    elements.tgtFlag.textContent = tgtOption.dataset.flag;
    checkLanguageMatch();
}

    // Check if languages match
    function checkLanguageMatch() {
    if (elements.srcLang.value === elements.tgtLang.value) {
    elements.langWarning.classList.remove('hidden');
    elements.recordBtn.disabled = true;
} else {
    elements.langWarning.classList.add('hidden');
    elements.recordBtn.disabled = false;
}
}

    // Swap languages
    elements.swapBtn.addEventListener('click', () => {
    const srcValue = elements.srcLang.value;
    const tgtValue = elements.tgtLang.value;
    elements.srcLang.value = tgtValue;
    elements.tgtLang.value = srcValue;
    updateFlags();
});

    elements.srcLang.addEventListener('change', updateFlags);
    elements.tgtLang.addEventListener('change', updateFlags);

    // Timer functions
    function startTimer() {
    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elements.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Auto-stop at max time
    if (elapsed >= MAX_RECORDING_TIME) {
    stopRecording();
}
}, 1000);
}

    function stopTimer() {
    if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
}
}

    // Visualizer
    function startVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 32;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = elements.visualizer.querySelectorAll('.visualizer-bar');

    visualizerInterval = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);
    bars.forEach((bar, i) => {
    const value = dataArray[i] || 0;
    const height = (value / 255) * 40 + 5;
    bar.style.height = height + 'px';
});
}, 50);
}

    function stopVisualizer() {
    if (visualizerInterval) {
    clearInterval(visualizerInterval);
    visualizerInterval = null;
}
    if (audioContext) {
    audioContext.close();
    audioContext = null;
}
}

    // Start recording
    async function startRecording() {
    try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
    audioChunks.push(event.data);
}
};

    mediaRecorder.onstop = async () => {
    await processRecording();
};

    mediaRecorder.start();

    // UI updates
    elements.recordBtn.disabled = true;
    elements.stopBtn.disabled = false;
    elements.srcLang.disabled = true;
    elements.tgtLang.disabled = true;
    elements.swapBtn.disabled = true;
    elements.recordingInfo.classList.remove('hidden');
    elements.visualizer.classList.remove('hidden');
    elements.status.className = 'status info';
    elements.status.textContent = '🎤 Listening... Speak clearly into your microphone';
    elements.status.classList.remove('hidden');

    startTimer();
    startVisualizer(stream);

} catch (error) {
    console.error('Error accessing microphone:', error);
    elements.status.className = 'status error';
    elements.status.textContent = '❌ Error: Could not access microphone. Please allow microphone access in your browser settings.';
    elements.status.classList.remove('hidden');
}
}

    // Stop recording
    function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());

    elements.recordBtn.disabled = false;
    elements.stopBtn.disabled = true;
    elements.srcLang.disabled = false;
    elements.tgtLang.disabled = false;
    elements.swapBtn.disabled = false;
    elements.recordingInfo.classList.add('hidden');
    elements.visualizer.classList.add('hidden');
    elements.progressBar.classList.remove('hidden');
    elements.status.className = 'status info';
    elements.status.innerHTML = '⚙️ Processing your audio<span class="loading"></span>';

    stopTimer();
    stopVisualizer();
}
}

    // Process recording
    async function processRecording() {
    try {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('src_lang', elements.srcLang.value);
    formData.append('tgt_lang', elements.tgtLang.value);

    const response = await fetch(`${API_URL}/api/translate-tts`, {
    method: 'POST',
    body: formData
});

    if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Translation failed: ${errorText}`);
}

    // Get the response headers for transcript and translation
    const transcript = response.headers.get('X-Original-Text');
    const translation = response.headers.get('X-Translated-Text');

    const resultBlob = await response.blob();

    // Revoke previous URL if exists
    if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
}

    currentAudioUrl = URL.createObjectURL(resultBlob);

    elements.audioOutput.src = currentAudioUrl;
    elements.audioOutput.classList.remove('hidden');
    elements.downloadBtn.classList.remove('hidden');
    elements.progressBar.classList.add('hidden');

    elements.status.className = 'status success';
    elements.status.textContent = '✅ Translation complete! Listen to your translated audio below.';

    // Show transcription section (with placeholder text for now)
    elements.transcriptionSection.classList.remove('hidden');
    elements.originalText.textContent = 'Transcription will appear here once API supports it';
    elements.translatedText.textContent = 'Translation will appear here once API supports it';

} catch (error) {
    console.error('Error processing recording:', error);
    elements.progressBar.classList.add('hidden');
    elements.status.className = 'status error';
    elements.status.textContent = '❌ Error: ' + error.message;
}
}

    // Download audio
    elements.downloadBtn.addEventListener('click', () => {
    if (currentAudioUrl) {
    const a = document.createElement('a');
    a.href = currentAudioUrl;
    a.download = `translation_${elements.tgtLang.value}_${Date.now()}.webm`;
    a.click();
}
});

    // Event listeners
    elements.recordBtn.addEventListener('click', startRecording);
    elements.stopBtn.addEventListener('click', stopRecording);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
    // Space to record
    if (e.code === 'Space' && !elements.recordBtn.disabled && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    if (mediaRecorder?.state !== 'recording') {
    startRecording();
}
}
    // Escape to stop
    if (e.code === 'Escape' && !elements.stopBtn.disabled) {
    e.preventDefault();
    stopRecording();
}
});

    // Initialize
    updateFlags();