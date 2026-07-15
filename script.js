// ----- DOM রেফারেন্স -----
const channelListDiv = document.getElementById('channelList');
const channelContainer = document.getElementById('channelContainer');
const playerContainer = document.getElementById('playerContainer');
const video = document.getElementById('videoPlayer');
const loadingOverlay = document.getElementById('loadingOverlay');
const noSignalOverlay = document.getElementById('noSignalOverlay');
const channelNameSpan = document.getElementById('channelName');
const topBar = document.getElementById('topBar');
const controls = document.getElementById('controls');
const backBtn = document.getElementById('backBtn');
const playBtn = document.getElementById('playBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

let hls = null;
let isPlaying = false;
let controlsTimer = null;
let currentChannelUrl = '';
let isNoSignalShowing = false;

const PLAYLIST_URL = 'https://raw.githubusercontent.com/imShakil/tvlink/refs/heads/main/iptv.m3u8';

// ----- ১. প্লেলিস্ট লোড করা -----
async function loadPlaylist() {
    try {
        const res = await fetch(PLAYLIST_URL);
        const text = await res.text();
        const channels = parseM3U8(text);
        renderChannels(channels);
    } catch (err) {
        channelContainer.innerHTML = `<p style="color:#ff6b6b;">❌ প্লেলিস্ট লোড করতে ব্যর্থ: ${err.message}</p>`;
    }
}

// ----- ২. M3U8 পার্সার -----
function parseM3U8(data) {
    const lines = data.split('\n');
    const channels = [];
    let current = null;
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('#EXTINF:')) {
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const nameMatch = line.match(/,([^,]*)$/);
            current = {
                name: nameMatch ? nameMatch[1].trim() : 'চ্যানেল',
                logo: logoMatch ? logoMatch[1] : '',
                group: groupMatch ? groupMatch[1] : 'অন্যান্য',
                url: ''
            };
        } else if (line.startsWith('http') && current) {
            current.url = line;
            if (current.url) channels.push({ ...current });
            current = null;
        }
    }
    return channels;
}

// ----- ৩. চ্যানেল লিস্ট রেন্ডার -----
function renderChannels(channels) {
    if (!channels.length) {
        channelContainer.innerHTML = '<p>কোনো চ্যানেল পাওয়া যায়নি।</p>';
        return;
    }
    const sorted = channels.sort((a,b) => a.group.localeCompare(b.group));
    let html = '';
    sorted.forEach(ch => {
        const logo = ch.logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="white"%3E%3Crect width="24" height="24" rx="4" fill="%23333"/%3E%3Ctext x="12" y="16" font-size="12" text-anchor="middle" fill="%23aaa"%3ETV%3C/text%3E%3C/svg%3E';
        html += `
            <div class="channel-item" data-url="${ch.url}" data-name="${ch.name}">
                <img src="${logo}" alt="${ch.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22 viewBox=%220 0 24 24%22 fill=%22white%22%3E%3Crect width=%2224%22 height=%2224%22 rx=%224%22 fill=%22%23333%22/%3E%3Ctext x=%2212%22 y=%2216%22 font-size=%2212%22 text-anchor=%22middle%22 fill=%22%23aaa%22%3ETV%3C/text%3E%3C/svg%3E'">
                <div class="info">
                    <div class="name">${ch.name}</div>
                    <div class="group">${ch.group}</div>
                </div>
            </div>
        `;
    });
    channelContainer.innerHTML = html;

    document.querySelectorAll('.channel-item').forEach(el => {
        el.addEventListener('click', function() {
            const url = this.dataset.url;
            const name = this.dataset.name;
            if (url) playChannel(url, name);
        });
    });
}

// ----- ৪. ভিডিও প্লে করা (নো-সিগন্যাল যোগ) -----
function playChannel(url, name) {
    if (!url) return;
    currentChannelUrl = url;
    channelNameSpan.textContent = name || 'চ্যানেল';

    // নো-সিগন্যাল লুকিয়ে রাখি
    noSignalOverlay.classList.remove('show');
    isNoSignalShowing = false;

    channelListDiv.style.display = 'none';
    playerContainer.style.display = 'block';

    if (hls) { hls.destroy(); hls = null; }
    video.pause();
    video.removeAttribute('src');
    video.load();

    loadingOverlay.style.display = 'block';
    isPlaying = false;
    playBtn.textContent = '▶';

    if (window.Hls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            loadingOverlay.style.display = 'none';
            video.play().then(() => {
                isPlaying = true;
                playBtn.textContent = '⏸';
                showControls(false);
            }).catch(() => {
                loadingOverlay.style.display = 'none';
                showNoSignal(); // প্লে না হলে নো-সিগন্যাল
            });
        });
        hls.on(Hls.Events.ERROR, (e, data) => {
            if (data.fatal) {
                loadingOverlay.style.display = 'none';
                showNoSignal();
                hls.destroy(); hls = null;
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        loadingOverlay.style.display = 'none';
        video.play().then(() => {
            isPlaying = true;
            playBtn.textContent = '⏸';
        }).catch(() => {
            loadingOverlay.style.display = 'none';
            showNoSignal();
        });
    } else {
        loadingOverlay.style.display = 'none';
        showNoSignal();
    }
}

// ----- ৫. নো-সিগন্যাল দেখানো (নতুন) -----
function showNoSignal() {
    noSignalOverlay.classList.add('show');
    isNoSignalShowing = true;
    // কন্ট্রোল দেখাই যাতে ইউজার ব্যাক বা রিট্রাই করতে পারে
    showControls(true);
}

// ----- ৬. কন্ট্রোল শো/হাইড -----
function showControls(force = false) {
    topBar.classList.add('active');
    controls.classList.add('active');
    if (controlsTimer) clearTimeout(controlsTimer);
    if (!force) {
        controlsTimer = setTimeout(() => {
            topBar.classList.remove('active');
            controls.classList.remove('active');
        }, 3500);
    }
}
playerContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    showControls(false);
});
playerContainer.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    showControls(false);
});

// ----- ৭. ব্যাক বাটন (ফুলস্ক্রিন থেকে ফিরে আসার সমস্যা সমাধান) -----
backBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    // ১. ফুলস্ক্রিন থেকে বের হোন (যদি থাকে)
    if (document.fullscreenElement) {
        try {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
            else if (document.msExitFullscreen) await document.msExitFullscreen();
        } catch (err) { /* ইগনোর */ }
    }

    // ২. HLS ধ্বংস ও ভিডিও ক্লিয়ার
    if (hls) { hls.destroy(); hls = null; }
    video.pause();
    video.removeAttribute('src');
    video.load();
    noSignalOverlay.classList.remove('show');
    isNoSignalShowing = false;

    // ৩. প্লেয়ার লুকিয়ে চ্যানেল লিস্ট দেখান
    playerContainer.style.display = 'none';
    channelListDiv.style.display = 'block';
});

// ----- ৮. প্লে/পজ -----
playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isNoSignalShowing) {
        // নো-সিগন্যাল থাকলে রিলোড চেষ্টা
        showNoSignal(); // আপাতত কিছু না, ইউজার ব্যাক করে আবার চেষ্টা করবে
        return;
    }
    if (video.paused) {
        video.play().then(() => { isPlaying = true; playBtn.textContent = '⏸'; });
    } else {
        video.pause();
        isPlaying = false;
        playBtn.textContent = '▶';
    }
    showControls(false);
});

// ----- ৯. ফুলস্ক্রিন -----
fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const el = playerContainer;
    if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
});

// ভিডিও শেষ হলে
video.addEventListener('ended', () => {
    isPlaying = false;
    playBtn.textContent = '▶';
    showControls(false);
});

// ----- ১০. শুরু করুন -----
loadPlaylist();