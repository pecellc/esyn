// Tunggu DOMContentLoaded: halaman statis tampil dulu, SDK Supabase
    // (defer) selesai dieksekusi, baru app-nya jalan.
    window.addEventListener('DOMContentLoaded', function () {
      /* ===== SUPABASE ===== */
      const SUPABASE_URL = 'https://ziibivkhualutrdiojto.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaWJpdmtodWFsdXRyZGlvanRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTE0NzgsImV4cCI6MjEwODY2NzQ3OH0.2kJM7uNIMxodj9GRU9B3QvLA7NZc2JjuUMN5U-i3-Z0';
      const OWNER_EMAIL = 'exceladila123@gmail.com';
      let ownerSignedIn = false;

      const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      });

      /* Semua aset sekarang lokal. Nggak ada CDN jsDelivr / Google Fonts. */
      function cdnUrl(path) { return path; }
      function setMedia(el, path) {
        el.dataset.localSrc = path;
        el.src = path;
        return el;
      }

      /* Foto dari admin bisa berupa URL eksternal atau data URL hasil kompres. */
      function isRemotePhoto(src) {
        return /^(https?:\/\/|data:image\/)/i.test(String(src || ''));
      }

      function setPhoto(el, src) {
        if (isRemotePhoto(src)) {
          el.removeAttribute('data-local-src');
          el.src = src;
        } else {
          setMedia(el, src);
        }
        return el;
      }

      function attachPhotoRetry(img, src, max) {
        // Data URL nggak ada gunanya di-retry (dan nambah '?__r' malah merusak).
        if (!/^data:/i.test(String(src || ''))) attachImgRetry(img, max || 4);
      }

      const TRACKS = [
        { src: 'audio/stereo love.mp4', name: 'Stereo Love' },
        { src: 'audio/ins.mp4', name: 'Luxury' },
        { src: "audio/don't.mp4", name: "Don't" },
        { src: 'audio/Flatline.mp4', name: 'Flatline' }
      ];

      const STATIC_GALLERY = [
        { title: 'Flower', desc: '', img: 'img/bunga.webp', featured: true, cat: 'nature' },
        { title: 'Art Piece', desc: 'Creativity', img: 'img/lukiduk.webp', cat: 'art' },
        { title: 'larp', desc: '', img: 'img/saham.webp', cat: 'people' },
        { title: 'Le Pantry', desc: 'Eating out', img: 'img/makan.webp', cat: 'food' },
        { title: 'Le Pantry', desc: 'Chilling at the cafe', img: 'img/me-duduk.webp', cat: 'people' },
        { title: 'Bandung', desc: 'Bandung in the afternoon', img: 'img/kota.webp', cat: 'city' },
        { title: 'Painting', desc: '', img: 'img/lukisan.webp', cat: 'art' },
        { title: 'Cool Painting', desc: '', img: 'img/lukisan1.webp', cat: 'art' },
        { title: 'Coffee', desc: '', img: 'img/meja.webp', cat: 'food' },
        { title: 'FRIENDS', desc: '', img: 'img/lirik.webp', cat: 'people' },
        { title: 'FOOD', desc: '', img: 'img/friendfries.webp', cat: 'food' },
        { title: 'ROTI O', desc: '', img: 'img/rotio.webp', cat: 'food' },
        { title: 'Flower', desc: '', img: 'img/bungakuning.webp', cat: 'nature' },
        { title: 'Ice Cream', desc: '', img: 'img/aisekerimu.webp', cat: 'food' },
        { title: 'Loblok', desc: '', img: 'img/lawd.webp', cat: 'game' }
      ];
      let GALLERY = STATIC_GALLERY.slice();

      const CAT_LABEL = { nature: 'Nature', art: 'Art', food: 'Food', people: 'People', city: 'City', game: 'Game' };

      const VIEWS = ['home', 'profil', 'hobi', 'galeri', 'kontak', 'zx7k9q'];

      const $ = (id) => document.getElementById(id);

      function safePlay(media) {
        try {
          const p = media.play();
          if (p && typeof p.catch === 'function') p.catch(() => { });
        } catch (e) { }
      }

      /* ===== IMAGE RETRY (foto nggak boleh ilang) ===== */
      const imgRetryCount = new WeakMap();

      function attachImgRetry(img, maxRetries = 4) {
        if (!img || img.dataset.retryBound === '1') return;
        img.dataset.retryBound = '1';
        imgRetryCount.set(img, 0);

        img.addEventListener('error', () => {
          const n = imgRetryCount.get(img) || 0;
          if (n >= maxRetries) {
            setTimeout(() => {
              if (img.naturalWidth === 0) img.classList.add('img-failed');
            }, 4000);
            return;
          }
          imgRetryCount.set(img, n + 1);
          img.classList.remove('img-failed');
          img.classList.add('retry-flash');
          setTimeout(() => img.classList.remove('retry-flash'), 520);

          const local = img.dataset.localSrc || img.src.replace(/[?&]__r=\d+$/, '');
          const sep = local.includes('?') ? '&' : '?';
          setTimeout(() => {
            img.src = local + sep + '__r=' + Date.now();
          }, 600 * (n + 1));
        });
      }

      /* ===== SKELETON SAMPAI FOTO SIAP ===== */
      function watchShimmer(img, holder) {
        if (!img || !holder) return;
        holder.classList.add('is-loading');
        const done = () => holder.classList.remove('is-loading');
        if (img.complete && img.naturalWidth > 0) {
          done();
          return;
        }
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }

      /* ===== VIDEO RETRY (video juga nggak boleh ilang) ===== */
      function attachVideoRetry(v, maxTries = 5) {
        if (!v || v.dataset.retryBound === '1') return;
        v.dataset.retryBound = '1';
        let tries = 0;
        v.addEventListener('error', () => {
          if (tries >= maxTries) return;
          tries++;
          const local = v.dataset.localSrc || v.src.replace(/[?&]__r=\d+$/, '');
          const sep = local.includes('?') ? '&' : '?';
          setTimeout(() => {
            v.src = local + sep + '__r=' + Date.now();
            v.play().catch(() => { });
          }, 700 * tries);
        });
      }

      /* ===== ROUTER ===== */
      function route() {
        let raw = (location.hash || '').replace(/^#\/?/, '');
        let view = raw.split('/')[0] || 'home';
        if (!VIEWS.includes(view)) view = 'home';

        if (view === 'zx7k9q' && !secretToken()) {
          location.hash = '#/home';
          return;
        }

        document.body.dataset.view = view;

        const newIdx = VIEWS.indexOf(view);
        const dir = (lastViewIdx === null || newIdx >= lastViewIdx) ? 1 : -1;
        document.documentElement.style.setProperty('--swipe-x', (dir * 80) + 'px');
        document.documentElement.style.setProperty('--swipe-out-x', (dir * -80) + 'px');
        lastViewIdx = newIdx;

        document.querySelectorAll('.view').forEach(v => {
          if (v.dataset.view === view) {
            v.classList.remove('leaving');
            v.classList.add('active');
          } else if (v.classList.contains('active')) {
            v.classList.remove('active');
            v.classList.add('leaving');
            setTimeout(() => v.classList.remove('leaving'), 480);
          }
        });

        const navKey = (view === 'hobi') ? 'profil' : view;
        document.querySelectorAll('.nav-links a').forEach(a => {
          a.classList.toggle('active', a.dataset.nav === navKey);
        });
        document.querySelectorAll('.drawer-inner a').forEach(a => {
          a.classList.toggle('active', a.dataset.nav === navKey);
        });
        moveNavIndicator();
        closeDrawer();

        document.title = 'exyn';
        /* scroll instant: kalo pake scroll-behavior smooth, seluruh halaman
           (mis. galeri ratusan px) di-animate pas ganti view sambil swipe
           animation jalan -> dobel animasi = jank di HP */
        const _de = document.documentElement;
        const _prevSb = _de.style.scrollBehavior;
        _de.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
        _de.style.scrollBehavior = _prevSb;

        if (view === 'kontak' && typeof ensureRatingLoaded === 'function') ensureRatingLoaded();

        // konten yang dibangun dinamis (grid foto, dll) bisa telat masuk;
        // daftarin ulang tiap ganti view biar nggak nyangkut opacity 0.
        if (typeof observeReveals === 'function') observeReveals();

        toggleSparkles(view === 'profil' || view === 'hobi');
        toggleCarFx(view === 'home');
      }

      let lastViewIdx = null;

      window.addEventListener('hashchange', route);

      /* ===== NAV INDICATOR ===== */
      function moveNavIndicator() {
        const ind = document.querySelector('.nav-indicator');
        const a = document.querySelector('.nav-links a.active');
        if (!ind || !a) return;
        ind.style.width = a.offsetWidth + 'px';
        ind.style.height = a.offsetHeight + 'px';
        ind.style.top = a.offsetTop + 'px';
        ind.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      }
      /* resize di HP nyala tiap URL bar muncul/menghilang -> di-debounce rAF
         biar moveNavIndicator (baca offsetWidth/offsetTop = forced reflow)
         nggak jalan berulang-ulang */
      let navIndRaf = 0;
      function queueNavIndicator() {
        if (navIndRaf) return;
        navIndRaf = requestAnimationFrame(() => {
          navIndRaf = 0;
          moveNavIndicator();
        });
      }
      window.addEventListener('resize', queueNavIndicator);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(queueNavIndicator);
      }
      /* Ganti tema = font/padding/letter-spacing link ikut berubah dan masih
         di-transition 0.22s. Kalau cuma diukur sekali di awal, pill-nya
         nyangkut di ukuran lama (bisa nutupin tombol tema). Jadi ukur ulang
         tiap geometri link benar-benar berubah. */
      const navLinksEl = document.querySelector('.nav-links');
      if (navLinksEl) {
        if (window.ResizeObserver) {
          const navRO = new ResizeObserver(queueNavIndicator);
          navRO.observe(navLinksEl);
          navLinksEl.querySelectorAll('a').forEach((el) => navRO.observe(el));
        }
        navLinksEl.addEventListener('transitionend', (e) => {
          if (e.target && e.target.tagName === 'A') queueNavIndicator();
        });
      }
      if (document.fonts && document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', queueNavIndicator);
      }

      /* ===== CLICK SOUND (Meet Me) ===== */
      const clickSfx = new Audio('audio/f1.mp4');
      const meetBtn = $('meet-me-btn');
      if (meetBtn) {
        meetBtn.addEventListener('click', () => {
          try {
            clickSfx.currentTime = 0;
            safePlay(clickSfx);
          } catch (e) { }
        });
      }

      /* ===== MUSIC PLAYER ===== */
      const audio = $('bg-audio');
      const mpBox = $('mp');
      let trackIndex = 0;
      let lastVolume = 0.8;

      function setRangeFill(input) {
        const min = parseFloat(input.min) || 0;
        const max = parseFloat(input.max) || 1;
        const val = parseFloat(input.value) || 0;
        input.style.setProperty('--p', ((val - min) / (max - min)) * 100);
      }

      function updateMpUI() {
        const playing = !audio.paused;
        mpBox.classList.toggle('playing', playing);
        $('mp-play').textContent = playing ? '❚❚' : '▶';
        $('mp-title').textContent = TRACKS[trackIndex].name;
        $('mp-sub-text').textContent = playing ? 'Now playing' : 'Tap to play';
        const heroTrack = $('hero-track');
        if (heroTrack) heroTrack.textContent = playing ? TRACKS[trackIndex].name : 'tap to play';
        document.querySelectorAll('#mp-list li').forEach((li, i) => {
          li.classList.toggle('active', i === trackIndex);
        });
      }

      function loadTrack(i, autoplay) {
        trackIndex = (i + TRACKS.length) % TRACKS.length;
        audio.dataset.localSrc = TRACKS[trackIndex].src;
        audio.src = TRACKS[trackIndex].src;
        localStorage.setItem('rv-track-v2', trackIndex);
        updateMpUI();
        if (autoplay) {
          userPaused = false;
          safePlay(audio);
          updateMpUI();
        }
      }

      // Musik gagal -> coba sekali lagi dengan cache-buster.
      audio.addEventListener('error', () => {
        const local = audio.dataset.localSrc;
        if (!local || audio.dataset.triedLocal) return;
        audio.dataset.triedLocal = '1';
        const sep = local.includes('?') ? '&' : '?';
        const resume = !audio.paused;
        setTimeout(() => {
          audio.src = local + sep + '__r=' + Date.now();
          if (resume || !userPaused) safePlay(audio);
        }, 500);
      });

      let userPaused = false;

      function togglePlay() {
        if (audio.muted) {
          audio.muted = false;
          mpVolume.value = audio.volume;
          setRangeFill(mpVolume);
          updateVolIcon();
        }
        if (audio.paused) {
          userPaused = false;
          safePlay(audio);
        } else {
          audio.pause();
          userPaused = true;
        }
        updateMpUI();
      }

      function buildTrackList() {
        const list = $('mp-list');
        list.innerHTML = '';
        TRACKS.forEach((t, i) => {
          const li = document.createElement('li');
          li.innerHTML = '<span class="track-no">' + (i + 1) + '</span><span>' + t.name + '</span>';
          li.addEventListener('click', () => {
            loadTrack(i, true);
            list.hidden = true;
          });
          list.appendChild(li);
        });
      }

      $('mp-play').addEventListener('click', () => {
        const wasOpen = mpBox.classList.contains('open');
        if (!wasOpen) mpBox.classList.add('open'); // menu slide keluar pas dipencet
        if (!wasOpen && !audio.paused) {
          // musik lagi jalan -> cukup buka menunya, jangan langsung pause
          if (audio.muted) {
            audio.muted = false;
            mpVolume.value = audio.volume;
            setRangeFill(mpVolume);
            updateVolIcon();
          }
          updateMpUI();
          return;
        }
        togglePlay(); // buka + nyalain, atau play/pause biasa kalo menu udah kebuka
      });
      $('mp-fold').addEventListener('click', () => {
        mpBox.classList.remove('open');
        $('mp-list').hidden = true;
      });
      $('mp-prev').addEventListener('click', () => {
        if (audio.currentTime > 3) {
          audio.currentTime = 0;
          updateMpSeek();
        } else {
          loadTrack(trackIndex - 1, true);
        }
      });
      $('mp-next').addEventListener('click', () => loadTrack(trackIndex + 1, true));

      // Lagu abis -> otomatis lanjut ke lagu berikutnya, habis semua -> ngulang dari awal
      audio.addEventListener('ended', () => {
        if (!userPaused) loadTrack(trackIndex + 1, true);
      });
      $('mp-list-btn').addEventListener('click', () => {
        const list = $('mp-list');
        list.hidden = !list.hidden;
      });

      /* ===== MUSIC SEEK BAR ===== */
      const mpProgress = $('mp-progress');
      let mpSeeking = false;

      function updateMpSeek() {
        $('mp-time').textContent = fmtTime(audio.currentTime);
        $('mp-dur').textContent = fmtTime(audio.duration);
        if (!mpSeeking) {
          mpProgress.value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
          setRangeFill(mpProgress);
        }
      }

      mpProgress.addEventListener('pointerdown', () => mpSeeking = true);
      mpProgress.addEventListener('pointerup', () => mpSeeking = false);
      mpProgress.addEventListener('input', () => {
        setRangeFill(mpProgress);
        if (audio.duration) {
          audio.currentTime = (mpProgress.value / 1000) * audio.duration;
          $('mp-time').textContent = fmtTime(audio.currentTime);
        }
      });

      $('mp-time').addEventListener('click', () => {
        audio.currentTime = 0;
        updateMpSeek();
      });

      audio.addEventListener('timeupdate', updateMpSeek);
      audio.addEventListener('loadedmetadata', updateMpSeek);
      audio.addEventListener('durationchange', updateMpSeek);
      audio.addEventListener('seeked', updateMpSeek);

      const mpVolume = $('mp-volume');
      mpVolume.addEventListener('input', () => {
        const v = parseFloat(mpVolume.value);
        audio.volume = v;
        if (v > 0) lastVolume = v;
        audio.muted = v === 0;
        localStorage.setItem('rv-vol', v);
        setRangeFill(mpVolume);
        updateVolIcon();
      });

      $('mp-vol-icon').addEventListener('click', () => {
        if (audio.muted || audio.volume === 0) {
          audio.muted = false;
          audio.volume = lastVolume || 0.8;
          mpVolume.value = audio.volume;
        } else {
          lastVolume = audio.volume;
          audio.muted = true;
          mpVolume.value = 0;
        }
        localStorage.setItem('rv-vol', mpVolume.value);
        setRangeFill(mpVolume);
        updateVolIcon();
      });

      function updateVolIcon() {
        const muted = audio.muted || audio.volume === 0;
        $('mp-vol-icon').textContent = muted ? '🔇' : (audio.volume < 0.5 ? '🔉' : '🔊');
      }

      audio.addEventListener('play', updateMpUI);
      audio.addEventListener('pause', updateMpUI);

      function initMusic() {
        const savedVol = parseFloat(localStorage.getItem('rv-vol'));
        const vol = isNaN(savedVol) ? 0.8 : savedVol;
        audio.volume = vol;
        mpVolume.value = vol;
        if (vol > 0) lastVolume = vol;
        setRangeFill(mpVolume);
        updateVolIcon();

        // Jangan autoplay: audio cuma bunyi setelah pengunjung pencet tombol play.
        loadTrack(0, false);
        updateMpUI();
      }

      /* ===== VIDEO RUBIK DIHAPUS — DIGANTI LINK INSTAGRAM =====
         Embed video bikin lag di HP, jadi halaman hobi sekarang cuma nampilin
         kartu link ke IG. fmtTime tetep dipake sama music player. */
      function fmtTime(s) {
        if (!isFinite(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return m + ':' + sec;
      }

      /* ===== GALERI ===== */
      let galFilter = 'all';
      let lbList = [];
      let lbIndex = 0;

      function currentGalList() {
        return galFilter === 'all' ? GALLERY : GALLERY.filter(g => g.cat === galFilter);
      }

      function buildGallery() {
        const grid = $('gallery-grid');
        const list = currentGalList();
        grid.innerHTML = '';
        list.forEach((item) => {
          const div = document.createElement('div');
          div.className = 'gallery-item' + (item.featured ? ' featured' : '');
          div.setAttribute('data-reveal', '');

          const img = document.createElement('img');
          img.className = 'gallery-img';
          setPhoto(img, item.img);
          img.alt = item.title;
          img.loading = 'lazy';
          img.decoding = 'async';
          attachPhotoRetry(img, item.img, 4);
          watchShimmer(img, div);

          const overlay = document.createElement('div');
          overlay.className = 'gallery-overlay';
          const ovText = document.createElement('div');
          ovText.className = 'gallery-overlay-text';
          const h3 = document.createElement('h3');
          h3.textContent = item.title;
          const p = document.createElement('p');
          p.textContent = item.desc || '';
          ovText.appendChild(h3);
          ovText.appendChild(p);
          overlay.appendChild(ovText);

          div.appendChild(img);
          div.appendChild(overlay);
          if (item.id != null) {
            addPhotoStar(div, item.id, 'gallery');
            addPhotoDelete(div, item.id);
          }

          div.addEventListener('click', () => openLightboxAt(list, list.indexOf(item)));
          grid.appendChild(div);
        });
        const empty = $('gallery-empty');
        if (empty) empty.hidden = list.length > 0;
        observeReveals(grid); // item baru (apalagi pas ganti filter) ikut animasi masuk
      }

      function buildGalleryFilters() {
        const wrap = $('gallery-filters');
        if (!wrap) return;
        const cats = [];
        GALLERY.forEach(g => { if (g.cat && cats.indexOf(g.cat) === -1) cats.push(g.cat); });
        if (galFilter !== 'all' && cats.indexOf(galFilter) === -1) galFilter = 'all';
        wrap.innerHTML = '';
        const mk = (val, label) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'filter-chip' + (val === galFilter ? ' on' : '');
          b.textContent = label + (val === 'all' ? ' ' + GALLERY.length : ' ' +
            GALLERY.filter(g => g.cat === val).length);
          b.addEventListener('click', () => {
            galFilter = val;
            wrap.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('on'));
            b.classList.add('on');
            buildGallery();
          });
          wrap.appendChild(b);
        };
        mk('all', 'All');
        cats.forEach(c => mk(c, CAT_LABEL[c] || c));
      }

      function openLightboxAt(list, i) {
        lbList = list && list.length ? list : GALLERY;
        lbIndex = ((i || 0) + lbList.length) % lbList.length;
        const item = lbList[lbIndex];
        const lb = $('lightbox-img');
        setPhoto(lb, item.img);
        attachPhotoRetry(lb, item.img, 6);
        imgRetryCount.set(lb, 0); // reset jatah retry tiap ganti foto
        lb.dataset.triedLocal = '';
        lb.classList.remove('img-failed');
        lb.alt = item.title;
        $('lightbox-title').textContent = item.title;
        $('lightbox-desc').textContent = item.desc || '';
        $('lightbox-count').textContent = (lbIndex + 1) + ' / ' + lbList.length;
        $('lightbox').classList.add('open');
      }

      function stepLightbox(d) {
        if (!$('lightbox').classList.contains('open')) return;
        openLightboxAt(lbList, lbIndex + d);
      }

      function openLightbox(item) {
        openLightboxAt(GALLERY, GALLERY.indexOf(item));
      }

      function closeLightbox() {
        $('lightbox').classList.remove('open');
      }

      $('lightbox-close').addEventListener('click', closeLightbox);
      $('lightbox').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeLightbox();
      });

      /* ===== ADMIN PHOTOS (public gallery + private secret) ===== */
      const LOCAL_PHOTOS_KEY = 'rv-photos-local-v1';

      let serverPhotos = [];
      let loadedSecretPhotos = [];
      let secretPhotos = [];
      let featuredGalleryId = '';
      let featuredSecretId = '';
      let localPhotos = readLocalPhotos();
      let photoLoading = false;
      let photoTableReady = false;

      function readLocalPhotos() {
        try {
          const raw = localStorage.getItem(LOCAL_PHOTOS_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr : [];
        } catch (e) {
          return [];
        }
      }

      function saveLocalPhotos(list) {
        try {
          localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(list));
          return true;
        } catch (e) {
          console.warn('local photo storage full:', e);
          return false;
        }
      }

      function photoKey(p) {
        return String(p.scope || 'gallery') + '|' + String(p.title || '') + '|' +
          String(p.image_url || p.img || '');
      }

      function allPhotoRows() {
        const seen = {};
        const out = [];
        serverPhotos.concat(localPhotos).forEach(p => {
          const k = photoKey(p);
          if (seen[k]) return;
          seen[k] = 1;
          out.push(p);
        });
        return out;
      }

      function normalizePhoto(row) {
        return {
          id: row.id == null ? 'local-' + Date.now() : row.id,
          scope: row.scope === 'secret' ? 'secret' : 'gallery',
          title: String(row.title || 'Photo').trim() || 'Photo',
          desc: String(row.caption != null ? row.caption : (row.desc || '')),
          cat: String(row.cat || 'people'),
          img: String(row.image_url || row.img || ''),
          sort: Number(row.sort_order) || 0,
          local: String(row.id || '').indexOf('local-') === 0
        };
      }

      function rebuildPhotoData() {
        const rows = allPhotoRows().map(normalizePhoto).filter(p => p.img);
        const galleryRows = rows.filter(p => p.scope === 'gallery');

        galleryRows.forEach(p => {
          p.featured = !!featuredGalleryId && String(p.id) === featuredGalleryId;
        });
        const statics = STATIC_GALLERY.map(g => ({
          ...g,
          featured: featuredGalleryId ? false : g.featured
        }));

        // foto bintang tampil paling atas (sebelum foto statis)
        let featuredRow = null;
        if (featuredGalleryId) {
          const fi = galleryRows.findIndex(p => String(p.id) === featuredGalleryId);
          if (fi >= 0) featuredRow = galleryRows.splice(fi, 1)[0];
        }
        GALLERY = (featuredRow ? [featuredRow] : []).concat(statics, galleryRows);
        const localSecret = rows.filter(p => p.scope === 'secret');
        secretPhotos = loadedSecretPhotos.concat(
          localSecret.filter(l => !loadedSecretPhotos.some(s => String(s.id) === String(l.id)))
        );
        if (featuredSecretId) {
          const si = secretPhotos.findIndex(p => String(p.id) === featuredSecretId);
          if (si > 0) secretPhotos.unshift(secretPhotos.splice(si, 1)[0]);
        }
        buildGalleryFilters();
        buildGallery();
        buildHomeShots();
        buildSecret();
        updatePhotoCounts();
        lastPhotoSignature = photoSignature();
      }

      function photoSignature() {
        return JSON.stringify(serverPhotos) + '|' + JSON.stringify(localPhotos);
      }
      let lastPhotoSignature = '';

      function updatePhotoCounts() {
        document.querySelectorAll('[data-count-gallery]').forEach(el => {
          el.dataset.counted = '1';
          el.textContent = GALLERY.length;
        });
        const shots = $('shots-count');
        if (shots) shots.textContent = GALLERY.length;
      }

      async function loadPhotos() {
        if (photoLoading) return;
        photoLoading = true;
        let timer = 0;
        try {
          const ctrl = new AbortController();
          timer = setTimeout(() => ctrl.abort(), 8000);
          const { data, error } = await db.from('gallery_photos')
            .select('id,scope,title,caption,cat,image_url,sort_order')
            .eq('scope', 'gallery')
            .order('sort_order', { ascending: true })
            .order('id', { ascending: true })
            .abortSignal(ctrl.signal);
          if (error) throw error;
          serverPhotos = data || [];
          photoTableReady = true;
        } catch (e) {
          photoTableReady = false;
        } finally {
          clearTimeout(timer);
          photoLoading = false;
          localPhotos = readLocalPhotos();
          if (photoSignature() !== lastPhotoSignature) rebuildPhotoData();
        }
      }

      function addPhotoDelete(parent, id) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'photo-del';
        b.textContent = '×';
        b.title = 'Delete photo';
        b.setAttribute('aria-label', 'Delete photo');
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isOwner()) return;
          if (!confirm('Delete this photo?')) return;
          b.disabled = true;
          const ok = await deletePhoto(id);
          if (!ok) {
            b.disabled = false;
            showToast('could not delete — run sql/security_journal.sql');
          }
        });
        parent.appendChild(b);
      }

      /* --- star foto: pilih foto "spesial" (owner only) --- */
      function isFeatured(scope, id) {
        if (id == null) return false;
        const cur = scope === 'secret' ? featuredSecretId : featuredGalleryId;
        return !!cur && String(cur) === String(id);
      }

      async function setFeatured(scope, value) {
        try {
          const { error } = await db.rpc('admin_set_content', {
            p_key: 'featured.' + scope,
            p_value: value || ''
          });
          if (error) throw error;
          return true;
        } catch (e) {
          console.warn('set featured photo:', e);
          return false;
        }
      }

      async function toggleFeatured(scope, id, btn) {
        if (!isOwner() || !btn || btn.disabled) return;
        const next = isFeatured(scope, id) ? '' : String(id);
        btn.disabled = true;
        const ok = await setFeatured(scope, next);
        btn.disabled = false;
        if (!ok) {
          showToast('could not save special photo');
          return;
        }
        if (scope === 'secret') featuredSecretId = next;
        else featuredGalleryId = next;
        rebuildPhotoData();
        showToast(next ? 'special photo updated ★' : 'special photo cleared');
      }

      function paintStar(btn, on) {
        btn.classList.toggle('on', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.title = on ? 'Special photo — click to remove' : 'Make this the special photo';
        btn.setAttribute('aria-label', btn.title);
      }

      function addPhotoStar(parent, id, scope) {
        if (id == null || String(id).indexOf('local-') === 0) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'photo-star';
        b.textContent = '★';
        b.dataset.pid = String(id);
        paintStar(b, isFeatured(scope, id));
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleFeatured(scope, b.dataset.pid, b);
        });
        parent.appendChild(b);
      }

      function refreshHeroStar(id) {
        const b = $('secret-hero-star');
        if (!b) return;
        if (id == null || String(id).indexOf('local-') === 0) {
          b.hidden = true;
          return;
        }
        if (!b.dataset.wired) {
          b.dataset.wired = '1';
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFeatured('secret', b.dataset.pid, b);
          });
        }
        b.hidden = false;
        b.dataset.pid = String(id);
        paintStar(b, isFeatured('secret', id));
      }

      async function deletePhoto(id) {
        if (String(id).indexOf('local-') === 0) {
          const list = readLocalPhotos().filter(p => String(p.id) !== String(id));
          if (!saveLocalPhotos(list)) return false;
          localPhotos = readLocalPhotos();
          rebuildPhotoData();
          showToast('photo removed');
          return true;
        }
        try {
          const { error } = await db.rpc('admin_delete_gallery_photo', {
            p_id: Number(id)
          });
          if (error) throw error;
          if (isFeatured('secret', id)) {
            await setFeatured('secret', '');
            featuredSecretId = '';
          }
          if (isFeatured('gallery', id)) {
            await setFeatured('gallery', '');
            featuredGalleryId = '';
          }
          if (secretPhotos.some(p => String(p.id) === String(id))) {
            await loadSecretPhotos();
          } else {
            await loadPhotos();
          }
          showToast('photo deleted');
          return true;
        } catch (e) {
          console.warn('delete photo:', e);
          return false;
        }
      }

      async function addPhoto(payload) {
        let timer = 0;
        try {
          const ctrl = new AbortController();
          timer = setTimeout(() => ctrl.abort(), 7000);
          const { data, error } = await db.rpc('admin_add_gallery_photo', {
            p_scope: payload.scope,
            p_title: payload.title,
            p_caption: payload.desc,
            p_cat: payload.cat,
            p_image: payload.img
          }).abortSignal(ctrl.signal);
          if (error) throw error;
          if (payload.scope === 'secret') await loadSecretPhotos();
          else await loadPhotos();
          return { ok: true, live: true, id: data };
        } catch (e) {
          console.warn('add photo (server):', e);
        } finally {
          clearTimeout(timer);
        }
        // Fallback: simpan di browser ini supaya fitur tetap jalan sebelum SQL dijalankan.
        const entry = {
          id: 'local-' + Date.now(),
          scope: payload.scope,
          title: payload.title,
          desc: payload.desc,
          cat: payload.cat,
          img: payload.img,
          sort_order: 9000000000000 + Date.now()
        };
        const list = readLocalPhotos();
        list.push(entry);
        if (!saveLocalPhotos(list)) return { ok: false, error: 'storage' };
        localPhotos = readLocalPhotos();
        rebuildPhotoData();
        return { ok: true, live: false };
      }

      /* Kompres gambar di browser: hemat kuota Supabase + cepat di HP */
      function compressImage(file, maxDim, maxB64) {
        maxDim = maxDim || 1280;
        maxB64 = maxB64 || 700000;
        return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            try {
              let w = img.naturalWidth || img.width;
              let h = img.naturalHeight || img.height;
              if (!w || !h) throw new Error('empty');
              const scale = Math.min(1, maxDim / Math.max(w, h));
              w = Math.max(1, Math.round(w * scale));
              h = Math.max(1, Math.round(h * scale));
              const c = document.createElement('canvas');
              const ctx = c.getContext('2d');
              const paint = () => {
                c.width = w;
                c.height = h;
                ctx.fillStyle = '#0a0a0c';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
              };
              paint();
              let q = 0.84;
              let out = c.toDataURL('image/jpeg', q);
              while (out.length > maxB64 && q > 0.44) {
                q -= 0.08;
                out = c.toDataURL('image/jpeg', q);
              }
              while (out.length > maxB64 && w > 480) {
                w = Math.round(w * 0.8);
                h = Math.round(h * 0.8);
                paint();
                out = c.toDataURL('image/jpeg', 0.72);
              }
              URL.revokeObjectURL(url);
              if (out.length > maxB64 * 1.7) reject(new Error('too large'));
              else resolve(out);
            } catch (e) {
              URL.revokeObjectURL(url);
              reject(e);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('read failed'));
          };
          img.src = url;
        });
      }

      let photoScope = 'gallery';
      let pendingPhotoFile = null;
      let pendingPreviewUrl = '';

      function setPhotoStatus(msg, kind) {
        const el = $('photo-status');
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'photo-status' + (kind ? ' ' + kind : '');
      }

      function setPhotoPreview(src) {
        const box = $('photo-preview');
        const img = $('photo-preview-img');
        if (!box || !img) return;
        if (pendingPreviewUrl) {
          URL.revokeObjectURL(pendingPreviewUrl);
          pendingPreviewUrl = '';
        }
        if (!src) {
          box.hidden = true;
          img.removeAttribute('src');
          return;
        }
        if (/^blob:/i.test(src)) pendingPreviewUrl = src;
        img.src = src;
        box.hidden = false;
      }

      function openPhotoModal(scope) {
        if (!isOwner()) {
          openOwn();
          return;
        }
        photoScope = scope === 'secret' ? 'secret' : 'gallery';
        $('photo-heading').textContent = photoScope === 'secret' ? 'Add hidden photo' : 'Add gallery photo';
        $('photo-sub').textContent = photoScope === 'secret'
          ? 'Only shows on the hidden page.'
          : 'Shows in the public gallery — total photo count updates automatically.';
        $('photo-cat-field').hidden = photoScope === 'secret';
        $('photo-title').value = '';
        $('photo-url').value = '';
        $('photo-file').value = '';
        $('photo-file-name').textContent = 'no file chosen';
        pendingPhotoFile = null;
        setPhotoPreview('');
        setPhotoStatus('');
        $('photo-overlay').classList.add('open');
        setTimeout(() => $('photo-title').focus(), 60);
      }

      function closePhotoModal() {
        $('photo-overlay').classList.remove('open');
        pendingPhotoFile = null;
        setPhotoPreview('');
      }

      function syncOwnerUI() {
        const owner = isOwner();
        document.body.classList.toggle('owner', owner);
        document.querySelectorAll('[data-owner-only]').forEach(el => {
          if (owner) el.removeAttribute('hidden');
          else el.setAttribute('hidden', '');
        });
        // tombol hapus di leaderboard ikut muncul/hilang tanpa reload
        if (typeof window.__lbRender === 'function') window.__lbRender();
      }

      if ($('gallery-add-photo')) $('gallery-add-photo').addEventListener('click', () => openPhotoModal('gallery'));
      if ($('secret-add-photo')) $('secret-add-photo').addEventListener('click', () => openPhotoModal('secret'));
      if ($('own-add-gallery')) $('own-add-gallery').addEventListener('click', () => openPhotoModal('gallery'));
      if ($('own-add-secret')) $('own-add-secret').addEventListener('click', () => openPhotoModal('secret'));
      if ($('photo-cancel')) $('photo-cancel').addEventListener('click', closePhotoModal);
      $('photo-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePhotoModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && $('photo-overlay').classList.contains('open')) closePhotoModal();
      });

      $('photo-file').addEventListener('change', () => {
        const f = $('photo-file').files && $('photo-file').files[0];
        pendingPhotoFile = f || null;
        $('photo-file-name').textContent = f
          ? f.name + ' (' + Math.round(f.size / 1024) + ' KB)'
          : 'no file chosen';
        if (f) {
          $('photo-url').value = '';
          setPhotoPreview(URL.createObjectURL(f));
          setPhotoStatus('');
        } else {
          setPhotoPreview('');
        }
      });

      $('photo-url').addEventListener('input', () => {
        const url = $('photo-url').value.trim();
        if (url) {
          pendingPhotoFile = null;
          $('photo-file').value = '';
          $('photo-file-name').textContent = 'no file chosen';
          setPhotoPreview(url);
        } else {
          setPhotoPreview('');
        }
        setPhotoStatus('');
      });

      $('photo-save').addEventListener('click', async () => {
        const btn = $('photo-save');
        if (btn.disabled) return;
        const title = $('photo-title').value.trim();
        const url = $('photo-url').value.trim();
        const cat = $('photo-cat').value || 'people';

        if (!pendingPhotoFile && !url) {
          setPhotoStatus('Pick a file or paste an image URL first.', 'bad');
          return;
        }
        if (url && !/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
          setPhotoStatus('URL must start with http:// or https://', 'bad');
          return;
        }

        btn.disabled = true;
        try {
          let img = url;
          if (pendingPhotoFile) {
            setPhotoStatus('Compressing image…');
            img = await compressImage(pendingPhotoFile);
          }
          setPhotoStatus('Saving…');
          const res = await addPhoto({
            scope: photoScope,
            title: title || 'Photo',
            desc: '',
            cat: photoScope === 'secret' ? 'people' : cat,
            img: img
          });
          if (!res.ok) {
            setPhotoStatus(res.error === 'storage'
              ? 'Browser storage is full. Use an image URL instead.'
              : 'Could not save. Try again.', 'bad');
            return;
          }
          closePhotoModal();
          showToast(res.live
            ? 'photo added ✓'
            : 'saved on this device — run sql/gallery_admin.sql to sync');
        } catch (e) {
          console.warn('save photo:', e);
          setPhotoStatus('Could not read that image. Try another one.', 'bad');
        } finally {
          btn.disabled = false;
        }
      });

      /* ===== KONTAK ===== */
      const contactForm = $('contact-form');
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = $('nama').value.trim();
        const email = ($('email') && $('email').value.trim()) || '';
        const subject = ($('subject') && $('subject').value.trim()) || '';
        const pesan = $('pesan').value.trim();
        const hp = $('hp-website').value;

        if (!nama || !pesan) {
          showToast('Please fill in your name and message');
          return;
        }

        const btn = contactForm.querySelector('.btn-submit');
        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = 'Sending...';

        try {
          if (hp) throw new Error('bot honeypot');
          const { error } = await db.rpc('send_message', {
            p_name: nama,
            p_email: email,
            p_subject: subject,
            p_message: pesan
          });
          if (error) throw error;
          contactForm.style.display = 'none';
          $('success-msg').classList.add('show');
          contactForm.reset();
        } catch (err) {
          const msg = /too many/i.test(String(err && err.message))
            ? 'Too many messages from this network. Try again later.'
            : 'Gagal mengirim pesan. Coba lagi ya.';
          showToast(msg);
          console.error(err);
        } finally {
          btn.disabled = false;
          btn.querySelector('.btn-text').textContent = 'Send Message';
        }
      });

      $('send-again').addEventListener('click', () => {
        $('success-msg').classList.remove('show');
        contactForm.style.display = 'block';
      });

      /* ===== RATING (bintang kayak app ojol) ===== */
      const RATING_KEY = 'rv-rated-v2';   // cache vote di browser ini
      const RATING_SCORE_KEY = 'rv-my-score-v2';
      const starWrap = $('rating-stars');
      const starBtns = Array.prototype.slice.call(starWrap.querySelectorAll('.star-btn'));
      const ratingStatus = $('rating-status');
      const ratingAvg = $('rating-avg');
      const ratingCount = $('rating-count');
      const ratingBarFill = $('rating-bar-fill');

      /* elemen popup rating (slide dari kanan) */
      const ratePop = $('rate-pop');
      const ratePopStarsWrap = $('rate-pop-stars');
      const ratePopStatus = $('rate-pop-status');
      const ratePopBtns = ratePopStarsWrap
        ? Array.prototype.slice.call(ratePopStarsWrap.querySelectorAll('.star-btn'))
        : [];
      const RATE_POP_KEY = 'rv-rate-pop-v1';

      let myScore = parseInt(localStorage.getItem(RATING_SCORE_KEY) || '', 10) || 0;
      let hasVoted = localStorage.getItem(RATING_KEY) === '1';

      function paintStars(n, preview) {
        starBtns.forEach((b, i) => {
          b.classList.toggle('on', i < n);
          b.classList.toggle('hover', !!preview && i < n && i >= myScore && n > myScore);
        });
      }

      function paintPopStars(n, preview) {
        ratePopBtns.forEach((b, i) => {
          b.classList.toggle('on', i < n);
          b.classList.toggle('hover', !!preview && i < n);
        });
      }

      function renderOverall(avg, count) {
        ratingAvg.textContent = count ? Number(avg).toFixed(1) : '-';
        ratingCount.textContent = count + (count === 1 ? ' vote' : ' votes');
        ratingBarFill.style.width = ((Number(avg) / 5) * 100) + '%';
        const popAvg = $('rate-pop-avg');
        const popCount = $('rate-pop-count');
        if (popAvg) popAvg.textContent = count ? Number(avg).toFixed(1) : '–';
        if (popCount) popCount.textContent = count + (count === 1 ? ' vote' : ' votes');
      }

      function lockRating(score, saveLocal) {
        myScore = score;
        hasVoted = true;
        if (saveLocal) {
          localStorage.setItem(RATING_KEY, '1');
          localStorage.setItem(RATING_SCORE_KEY, String(score));
        }
        starWrap.classList.add('locked');
        starBtns.forEach(b => b.disabled = true);
        paintStars(score);
        if (ratePopStarsWrap) ratePopStarsWrap.classList.add('locked');
        ratePopBtns.forEach(b => b.disabled = true);
        paintPopStars(score);
        ratingStatus.textContent = 'You rated this ' + score + ' \u2605 \u2014 thanks!';
        if (ratePopStatus) ratePopStatus.textContent = 'You rated this ' + score + ' \u2605 \u2014 thanks!';
      }

      async function loadRatingSummary() {
        try {
          const { data, error } = await db.rpc('rating_summary');
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          const count = Number(row && row.vote_count) || 0;
          const avg = Number(row && row.avg_score) || 0;
          renderOverall(avg, count);
          if (!hasVoted) setRatingStatus(count ? 'Tap a star to rate' : 'Be the first to rate!');
        } catch (e) {
          console.warn('rating summary:', e);
          renderOverall(0, 0);
          if (!hasVoted) setRatingStatus('Rating is not available yet');
        }
      }

      /* Server tahu vote dari jaringan ini lewat hash IP — bukan IP mentah. */
      async function checkIpVote() {
        if (hasVoted) return true;
        try {
          const { data, error } = await db.rpc('my_rating');
          if (!error && data != null) {
            lockRating(Number(data) || 1, true);
            return true;
          }
        } catch (e) { /* kolom baru belum ada -> biarin */ }
        return false;
      }

      /* Kirim vote. 'dup' = jaringan ini udah kekunci di server */
      async function submitVote(score) {
        const rpc = await db.rpc('vote_rating', { p_score: score });
        if (!rpc.error) return 'ok';
        if (/already voted/i.test(String(rpc.error.message || ''))) return 'dup';
        throw rpc.error;
      }

      function setRatingStatus(text) {
        ratingStatus.textContent = text;
        if (ratePopStatus) ratePopStatus.textContent = text;
      }

      let ratingSending = false;

      /* satu jalur kirim vote buat kartu kontak & popup */
      async function sendRating(score) {
        if (hasVoted || ratingSending) return;
        ratingSending = true;
        starBtns.forEach(x => x.disabled = true);
        ratePopBtns.forEach(x => x.disabled = true);
        setRatingStatus('Sending...');
        try {
          const res = await submitVote(score);
          if (res === 'dup') {
            // udah vote dari jaringan ini -> kunci pakai skor asli dari server
            const got = await checkIpVote();
            if (!got) lockRating(score, true);
          } else {
            lockRating(score, true);
            loadRatingSummary();
          }
          showToast('thanks for rating ' + score + ' ★');
          if (ratePop && ratePop.classList.contains('show')) {
            setTimeout(() => hideRatePop(), 900);
          }
        } catch (e) {
          console.warn('rating submit:', e);
          starBtns.forEach(x => x.disabled = false);
          ratePopBtns.forEach(x => x.disabled = false);
          setRatingStatus('Could not send rating, try again later');
        } finally {
          ratingSending = false;
        }
      }

      if (hasVoted) {
        lockRating(myScore, false);
      } else {
        setRatingStatus('Tap a star to rate');
        starBtns.forEach(b => {
          b.addEventListener('mouseenter', () => paintStars(parseInt(b.dataset.score, 10), true));
          b.addEventListener('mouseleave', () => paintStars(0));
        });
      }

      starBtns.forEach(b => {
        b.addEventListener('click', () => {
          if (hasVoted) return;
          sendRating(parseInt(b.dataset.score, 10));
        });
      });

      /* --- popup rating: muncul dari kanan setelah 15 detik --- */
      let ratePopShown = false;

      function canShowRatePop() {
        if (!ratePop || hasVoted || ratePopShown) return false;
        if (document.body.classList.contains('editing-text')) return false;
        if (document.body.dataset.view === 'zx7k9q') return false;
        if (isOwner()) return false;
        if (fbOverlay && fbOverlay.classList.contains('open')) return false;
        if (ownOverlay && ownOverlay.classList.contains('open')) return false;
        const lightboxEl = $('lightbox');
        if (lightboxEl && lightboxEl.classList.contains('open')) return false;
        const drawerBox = $('nav-drawer');
        if (drawerBox && drawerBox.classList.contains('open')) return false;
        const pwBox = $('pw-overlay');
        if (pwBox && pwBox.classList.contains('open')) return false;
        const themeBox = $('theme-pop');
        if (themeBox && themeBox.classList.contains('show')) return false;
        let snooze = 0;
        try { snooze = Number(localStorage.getItem(RATE_POP_KEY) || 0); } catch (e) { }
        return !(snooze && Date.now() < snooze);
      }

      function showRatePop() {
        if (!canShowRatePop()) return;
        ratePopShown = true;
        ensureRatingLoaded();
        if (!hasVoted) {
          checkIpVote().then(voted => { if (voted) hideRatePop(); });
        }
        ratePop.classList.add('show');
        ratePop.inert = false;
        ratePop.setAttribute('aria-hidden', 'false');
      }

      function hideRatePop(days) {
        if (!ratePop) return;
        ratePop.classList.remove('show');
        ratePop.inert = true;
        ratePop.setAttribute('aria-hidden', 'true');
        if (days) {
          try { localStorage.setItem(RATE_POP_KEY, String(Date.now() + days * 86400000)); } catch (e) { }
        }
      }

      if (ratePopBtns.length) {
        ratePopBtns.forEach(b => {
          b.addEventListener('mouseenter', () => {
            if (!hasVoted) paintPopStars(parseInt(b.dataset.score, 10), true);
          });
          b.addEventListener('mouseleave', () => paintPopStars(hasVoted ? myScore : 0));
          b.addEventListener('click', () => {
            if (hasVoted) return;
            sendRating(parseInt(b.dataset.score, 10));
          });
        });
      }

      if ($('rate-pop-close')) {
        $('rate-pop-close').addEventListener('click', () => hideRatePop(7));
      }
      if ($('rate-pop-fb')) {
        $('rate-pop-fb').addEventListener('click', () => {
          hideRatePop(7);
          const openFb = $('fb-open');
          if (openFb) openFb.click();
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ratePop && ratePop.classList.contains('show')) hideRatePop(7);
      });

      // hitung 15 detik waktu layar beneran kelihatan (tab hidden nggak dihitung)
      let rateDwell = 0;
      const rateDwellTimer = setInterval(() => {
        if (ratePopShown) { clearInterval(rateDwellTimer); return; }
        if (document.hidden) return;
        rateDwell += 1;
        if (rateDwell >= 15 && canShowRatePop()) {
          clearInterval(rateDwellTimer);
          showRatePop();
        }
      }, 1000);

      // Ambil ringkasan rating pas pertama kali buka halaman kontak
      let ratingLoaded = false;
      function ensureRatingLoaded() {
        if (ratingLoaded) return;
        ratingLoaded = true;
        loadRatingSummary();
        if (!hasVoted) checkIpVote();
      }

      /* ===== OWNER LOGIN + PANEL ADMIN ===== */
      const ownOverlay = $('own-overlay');
      const ownLogin = $('own-login');
      const ownPanel = $('own-panel');
      const ownStatus = $('own-login-status');
      const navLogo = $('nav-logo');

      function isOwner() {
        return ownerSignedIn;
      }

      function setOwnStatus(msg, bad) {
        if (!ownStatus) return;
        ownStatus.textContent = msg || '';
        ownStatus.className = 'own-hint' + (bad ? ' bad' : '');
      }

      function openOwn() {
        if (isOwner()) {
          showOwnPanel();
          return;
        }
        ownLogin.hidden = false;
        ownPanel.hidden = true;
        $('own-heading').textContent = 'Owner Login';
        $('own-subheading').textContent = 'Enter the owner password.';
        setOwnStatus('');
        ownOverlay.classList.add('open');
      }

      function closeOwn() {
        ownOverlay.classList.remove('open');
        ownOverlay.classList.remove('error');
      }

      navLogo.addEventListener('click', openOwn);
      $('own-cancel').addEventListener('click', closeOwn);
      $('own-close').addEventListener('click', closeOwn);
      ownOverlay.addEventListener('click', (e) => {
        if (e.target === ownOverlay) closeOwn();
      });

      async function refreshOwner() {
        try {
          const { data } = await db.auth.getSession();
          const user = data && data.session && data.session.user;
          ownerSignedIn = !!(user && String(user.email || '').toLowerCase() === OWNER_EMAIL);
        } catch (e) {
          ownerSignedIn = false;
        }
        navLogo.classList.toggle('owner-on', ownerSignedIn);
        syncOwnerUI();
      }

      db.auth.onAuthStateChange((event, session) => {
        const user = session && session.user;
        const next = !!(user && String(user.email || '').toLowerCase() === OWNER_EMAIL);
        const wasOwner = ownerSignedIn;
        ownerSignedIn = next;
        navLogo.classList.toggle('owner-on', next);
        syncOwnerUI();

        if (next && !wasOwner) {
          showToast('owner signed in ✓');
          if (ownOverlay.classList.contains('open')) showOwnPanel();
        }
        if (!next && wasOwner) {
          showToast('signed out');
          if (!ownOverlay.classList.contains('open')) ownPanel.hidden = true;
        }
        if (event === 'SIGNED_IN' && next && ownOverlay.classList.contains('open')) {
          showOwnPanel();
        }
      });

      let loginBusy = false;
      async function loginOwner(event) {
        if (event) event.preventDefault();
        if (loginBusy) return;
        const input = $('own-pass');
        const password = input ? input.value : '';
        if (!password) {
          setOwnStatus('Enter your password.', true);
          return;
        }
        loginBusy = true;
        const btn = $('own-login-btn');
        btn.disabled = true;
        setOwnStatus('Checking…');
        try {
          const { error } = await db.auth.signInWithPassword({
            email: OWNER_EMAIL,
            password: password
          });
          if (error) throw error;
          if (input) input.value = '';
          setOwnStatus('');
        } catch (e) {
          console.warn('owner login:', e);
          const msg = String(e && e.message || '');
          if (/invalid login credentials/i.test(msg)) {
            setOwnStatus('Wrong password.', true);
          } else if (/email not confirmed/i.test(msg)) {
            setOwnStatus('This account is not confirmed yet. Confirm it in Supabase → Authentication → Users.', true);
          } else {
            setOwnStatus('Could not sign in: ' + (msg || 'unknown error'), true);
          }
          if (input) {
            input.value = '';
            input.focus();
          }
        } finally {
          btn.disabled = false;
          loginBusy = false;
        }
      }

      const ownLoginForm = $('own-login-form');
      if (ownLoginForm) ownLoginForm.addEventListener('submit', loginOwner);
      if ($('own-login-btn')) $('own-login-btn').addEventListener('click', loginOwner);

      $('own-logout').addEventListener('click', async () => {
        try { await db.auth.signOut(); } catch (e) { }
        ownerSignedIn = false;
        navLogo.classList.remove('owner-on');
        syncOwnerUI();
        ownPanel.hidden = true;
        ownLogin.hidden = false;
        $('own-heading').textContent = 'Owner Login';
        $('own-subheading').textContent = 'Enter the owner password.';
        setOwnStatus('Signed out.');
      });

      async function showOwnPanel() {
        ownLogin.hidden = true;
        ownPanel.hidden = false;
        $('own-heading').textContent = 'Owner Panel';
        $('own-subheading').textContent = 'Inbox, photos, secret page & live text.';
        ownOverlay.classList.add('open');
        await loadOwnData();
      }

      function fmtShortDate(s) {
        try {
          return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
        } catch (e) {
          return '';
        }
      }

      function escHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      /* --- jalur tulis owner: server cek public.is_owner() --- */
      async function adminUpdateRating(id, score) {
        const { error } = await db.rpc('admin_update_rating', { p_id: id, p_score: score });
        if (!error) return true;
        console.warn('admin update rating:', error);
        return false;
      }

      async function adminDeleteRating(id) {
        const { error } = await db.rpc('admin_delete_rating', { p_id: id });
        if (!error) return true;
        console.warn('admin delete rating:', error);
        return false;
      }

      async function adminUpdateFeedback(id, message) {
        const { error } = await db.rpc('admin_update_feedback', { p_id: id, p_message: message });
        if (!error) return true;
        console.warn('admin update feedback:', error);
        return false;
      }

      async function adminDeleteFeedback(id) {
        const { error } = await db.rpc('admin_delete_feedback', { p_id: id });
        if (!error) return true;
        console.warn('admin delete feedback:', error);
        return false;
      }

      async function adminUpdateMessage(id, status) {
        const { error } = await db.rpc('admin_update_message', { p_id: id, p_status: status });
        if (!error) return true;
        console.warn('admin update message:', error);
        return false;
      }

      async function adminDeleteMessage(id) {
        const { error } = await db.rpc('admin_delete_message', { p_id: id });
        if (!error) return true;
        console.warn('admin delete message:', error);
        return false;
      }

      function flashBtn(btn, label) {
        const old = btn.textContent;
        btn.textContent = label;
        setTimeout(() => { btn.textContent = old; }, 1600);
      }

      /* --- pesan masuk --- */
      function renderMessages(rows) {
        const box = $('own-messages');
        const count = $('own-msg-count');
        if (count) count.textContent = rows.length + (rows.length === 1 ? ' message' : ' messages');
        if (!box) return;
        if (!rows.length) {
          box.innerHTML = '<div class="own-empty">Belum ada pesan.</div>';
          return;
        }
        box.innerHTML = '';
        rows.forEach((r) => {
          const row = document.createElement('div');
          row.className = 'own-row own-msg-row' + (r.status === 'unread' ? ' unread' : '');
          const opts = ['unread', 'read', 'replied'].map(s =>
            '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + s + '</option>'
          ).join('');
          row.innerHTML =
            '<div class="own-msg-head"><b>#' + r.id + ' · ' + escHtml(r.name) + '</b>' +
            '<span class="own-when">' + fmtShortDate(r.created_at) + '</span></div>' +
            '<div class="own-msg-meta">' +
            (r.email ? '<a href="mailto:' + escHtml(r.email) + '">' + escHtml(r.email) + '</a>' : 'no email') +
            ' · ' + escHtml(r.subject || 'Website message') + '</div>' +
            '<p class="own-msg-body">' + escHtml(r.message).replace(/\n/g, '<br>') + '</p>' +
            '<div class="own-row-actions">' +
            '<select class="own-status" aria-label="message status">' + opts + '</select>' +
            '<button type="button" class="own-save">Save</button>' +
            '<button type="button" class="own-del">Del</button></div>';
          const saveBtn = row.querySelector('.own-save');
          const delBtn = row.querySelector('.own-del');
          saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            const ok = await adminUpdateMessage(r.id, row.querySelector('.own-status').value);
            saveBtn.disabled = false;
            flashBtn(saveBtn, ok ? 'Saved' : 'Failed');
            if (ok) loadOwnData();
          });
          delBtn.addEventListener('click', async () => {
            if (!confirm('Delete message #' + r.id + '?')) return;
            delBtn.disabled = true;
            if (await adminDeleteMessage(r.id)) loadOwnData();
            else { delBtn.disabled = false; flashBtn(delBtn, 'Failed'); }
          });
          box.appendChild(row);
        });
      }

      async function loadOwnData() {
        if (!isOwner()) return;
        const ratBox = $('own-ratings');
        const fbBox = $('own-feedback');
        const msgBox = $('own-messages');
        [ratBox, fbBox, msgBox].forEach(el => {
          if (el) el.innerHTML = '<div class="own-empty">Loading…</div>';
        });
        ['own-rating-count', 'own-fb-count', 'own-msg-count'].forEach(id => {
          const el = $(id); if (el) el.textContent = '';
        });

        const [rat, fb, msg] = await Promise.all([
          db.rpc('admin_list_ratings'),
          db.rpc('admin_list_feedback'),
          db.rpc('admin_list_messages')
        ]);

        /* ratings */
        if (rat.error) {
          if (ratBox) ratBox.innerHTML = '<div class="own-empty">Ratings belum siap — jalankan SQL migrasi.</div>';
        } else {
          const rows = rat.data || [];
          $('own-rating-count').textContent = rows.length + ' votes';
          ratBox.innerHTML = rows.length ? '' : '<div class="own-empty">No votes yet</div>';
          rows.forEach((r) => {
            const row = document.createElement('div');
            row.className = 'own-row';
            let opts = '';
            for (let n = 1; n <= 5; n++) {
              opts += '<option value="' + n + '"' + (Number(r.score) === n ? ' selected' : '') + '>' + n + ' \u2605</option>';
            }
            row.innerHTML =
              '<span class="own-rid">#' + r.id + '</span>' +
              '<select class="own-score" aria-label="score">' + opts + '</select>' +
              '<span class="own-when">' + fmtShortDate(r.created_at) + '</span>' +
              '<button type="button" class="own-save">Save</button>' +
              '<button type="button" class="own-del">Del</button>';
            const btn = row.querySelector('.own-save');
            const del = row.querySelector('.own-del');
            btn.addEventListener('click', async () => {
              const val = Number(row.querySelector('.own-score').value);
              btn.disabled = true;
              const ok = await adminUpdateRating(r.id, val);
              btn.disabled = false;
              flashBtn(btn, ok ? 'Saved' : 'Failed');
              if (ok) loadRatingSummary();
            });
            del.addEventListener('click', async () => {
              if (!confirm('Delete rating #' + r.id + '?')) return;
              del.disabled = true;
              if (await adminDeleteRating(r.id)) { loadOwnData(); loadRatingSummary(); }
              else { del.disabled = false; flashBtn(del, 'Failed'); }
            });
            ratBox.appendChild(row);
          });
        }

        /* feedback */
        if (fb.error) {
          if (fbBox) fbBox.innerHTML = '<div class="own-empty">Feedback belum siap — jalankan SQL migrasi.</div>';
        } else {
          const rows = fb.data || [];
          $('own-fb-count').textContent = rows.length + ' msgs';
          fbBox.innerHTML = rows.length ? '' : '<div class="own-empty">No feedback yet</div>';
          rows.forEach((r) => {
            const row = document.createElement('div');
            row.className = 'own-row';
            row.innerHTML =
              '<span class="own-rid">#' + r.id + '</span>' +
              '<textarea class="own-msg" rows="1" aria-label="feedback">' + escHtml(r.message || '') + '</textarea>' +
              '<button type="button" class="own-save">Save</button>' +
              '<button type="button" class="own-del">Del</button>';
            const saveBtn = row.querySelector('.own-save');
            const delBtn = row.querySelector('.own-del');
            saveBtn.addEventListener('click', async () => {
              const val = row.querySelector('.own-msg').value.trim();
              if (!val) return;
              saveBtn.disabled = true;
              const ok = await adminUpdateFeedback(r.id, val);
              saveBtn.disabled = false;
              flashBtn(saveBtn, ok ? 'Saved' : 'Failed');
            });
            delBtn.addEventListener('click', async () => {
              if (!confirm('Delete this feedback #' + r.id + '?')) return;
              delBtn.disabled = true;
              if (await adminDeleteFeedback(r.id)) loadOwnData();
              else { delBtn.disabled = false; flashBtn(delBtn, 'Failed'); }
            });
            fbBox.appendChild(row);
          });
        }

        if (msg.error) {
          if (msgBox) msgBox.innerHTML = '<div class="own-empty">Inbox belum siap — jalankan SQL migrasi.</div>';
        } else {
          renderMessages(msg.data || []);
        }
      }

      /* tombol-tombol panel */
      if ($('own-secret-save')) {
        $('own-secret-save').addEventListener('click', async () => {
          if (!isOwner()) return;
          const a = $('own-secret-pw').value;
          const b = $('own-secret-pw2').value;
          const st = $('own-secret-status');
          if (a.length < 8) { st.textContent = 'Minimal 8 karakter.'; return; }
          if (a !== b) { st.textContent = 'Konfirmasi password belum sama.'; return; }
          const btn = $('own-secret-save');
          btn.disabled = true;
          st.textContent = 'Saving…';
          try {
            const { error } = await db.rpc('admin_set_secret_password', { p_password: a });
            if (error) throw error;
            $('own-secret-pw').value = '';
            $('own-secret-pw2').value = '';
            st.textContent = 'Password secret diganti. Semua sesi lama otomatis logout.';
            secretTokenClear();
            updateLockBtn();
          } catch (e) {
            console.warn('secret password:', e);
            st.textContent = 'Gagal menyimpan: ' + (e.message || 'error');
          } finally {
            btn.disabled = false;
          }
        });
      }

      /* ===== ADMIN TEXT EDITOR (copy langsung di halaman) ===== */
      let editingText = false;
      const textOverrides = {};

      async function loadSiteContent() {
        if (editingText) return;
        try {
          const { data, error } = await db.from('site_content').select('key,value');
          if (error) throw error;
          let featuredChanged = false;
          (data || []).forEach(row => {
            const val = String(row.value == null ? '' : row.value).trim();
            if (row.key === 'featured.gallery') { featuredGalleryId = val; featuredChanged = true; }
            if (row.key === 'featured.secret') { featuredSecretId = val; featuredChanged = true; }
            if (!val) return;
            if (row.key) textOverrides[row.key] = val;
            document.querySelectorAll('[data-edit]').forEach(el => {
              if (el.dataset.edit === row.key) el.textContent = val;
            });
          });
          if (featuredChanged) rebuildPhotoData();
        } catch (e) { /* tabel belum dibuat — teks asli tetap dipakai */ }
      }

      function startTextEdit() {
        if (!isOwner() || editingText) return;
        closeOwn();
        editingText = true;
        document.body.classList.add('editing-text');
        document.querySelectorAll('[data-edit]').forEach(el => {
          el.dataset.editOrig = el.textContent;
          el.setAttribute('contenteditable', 'true');
          el.setAttribute('spellcheck', 'false');
        });
        const bar = $('edit-bar');
        if (bar) bar.classList.add('show');
        showToast('click the highlighted text to edit');
      }

      async function saveTextChanges(changes) {
        let ok = 0, bad = 0;
        for (const c of changes) {
          try {
            const { error } = await db.rpc('admin_set_content', {
              p_key: c[0], p_value: c[1]
            });
            if (error) throw error;
            ok++;
          } catch (e) {
            bad++;
            console.warn('save text:', c[0], e);
          }
        }
        if (bad) showToast(ok + ' saved, ' + bad + ' failed — run the SQL');
        else showToast(ok + ' text saved ✓');
        if (!bad) loadSiteContent();
      }

      function endTextEdit(save) {
        if (!editingText) return;
        const changes = [];
        document.querySelectorAll('[data-edit]').forEach(el => {
          el.removeAttribute('contenteditable');
          el.removeAttribute('spellcheck');
          const now = el.textContent.replace(/\s+/g, ' ').trim();
          const orig = String(el.dataset.editOrig || '').replace(/\s+/g, ' ').trim();
          if (save && now && now !== orig) changes.push([el.dataset.edit, now]);
          if (!save && el.dataset.editOrig != null) el.textContent = el.dataset.editOrig;
          delete el.dataset.editOrig;
        });
        editingText = false;
        document.body.classList.remove('editing-text');
        const bar = $('edit-bar');
        if (bar) bar.classList.remove('show');
        if (!save) { showToast('edit cancelled'); return; }
        if (!changes.length) { showToast('nothing changed'); return; }
        saveTextChanges(changes);
      }

      const ownEditBtn = $('own-edit-text');
      if (ownEditBtn) ownEditBtn.addEventListener('click', startTextEdit);
      if ($('edit-save')) $('edit-save').addEventListener('click', () => endTextEdit(true));
      if ($('edit-cancel')) $('edit-cancel').addEventListener('click', () => endTextEdit(false));
      document.addEventListener('keydown', (e) => {
        if (!editingText) return;
        if (e.key === 'Escape') { e.preventDefault(); endTextEdit(false); }
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          endTextEdit(true);
        }
      });

      /* ===== FEEDBACK (anonymous, bebas berapa kali) ===== */
      const fbOverlay = $('fb-overlay');
      const fbText = $('fb-text');
      const fbError = $('fb-error');
      const fbOpenBtn = $('fb-open');

      function fbShake() {
        fbOverlay.classList.remove('error');
        void fbOverlay.offsetWidth;
        fbOverlay.classList.add('error');
        fbError.classList.add('show');
      }

      fbOpenBtn.addEventListener('click', () => {
        fbError.classList.remove('show');
        fbOverlay.classList.remove('error');
        fbOverlay.classList.add('open');
        setTimeout(() => fbText.focus(), 60);
      });

      $('fb-cancel').addEventListener('click', () => fbOverlay.classList.remove('open'));
      fbOverlay.addEventListener('click', (e) => {
        if (e.target === fbOverlay) fbOverlay.classList.remove('open');
      });

      $('fb-send').addEventListener('click', async () => {
        const txt = fbText.value.trim();
        if (!txt) {
          fbError.textContent = 'Write something first';
          fbShake();
          return;
        }
        fbError.classList.remove('show');
        const btn = $('fb-send');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        try {
          const { error } = await db.from('feedback').insert({ message: txt, name: 'Anonymous' });
          if (error) throw error;
          fbText.value = '';
          fbOverlay.classList.remove('open');
          fbOpenBtn.textContent = 'thanks for the feedback! \u2665';
          setTimeout(() => {
            fbOpenBtn.textContent = 'give me feedback';
          }, 3000);
        } catch (e) {
          console.warn('feedback submit:', e);
          fbError.textContent = 'Feedback not available yet \u2014 run the SQL in Supabase';
          fbShake();
        } finally {
          btn.disabled = false;
          btn.textContent = 'Send';
        }
      });

      /* ===== PASSWORD GATE (server-verified, rate limited) ===== */
      const pwOverlay = $('pw-overlay');
      const pwInput = $('pw-input');
      const pwError = $('pw-error');
      const SECRET_TOKEN_KEY = 'rv-secret-token-v2';
      let pwRedirectTimer = null;

      function secretToken() {
        try { return sessionStorage.getItem(SECRET_TOKEN_KEY) || ''; } catch (e) { return ''; }
      }
      function secretTokenSet(token) {
        try { sessionStorage.setItem(SECRET_TOKEN_KEY, token); } catch (e) { }
      }
      function secretTokenClear() {
        try { sessionStorage.removeItem(SECRET_TOKEN_KEY); } catch (e) { }
        secretPhotos = [];
        buildSecret();
      }

      function openPwModal() {
        if (secretToken()) {
          loadSecretPhotos();
          location.hash = '#/zx7k9q';
          return;
        }
        pwError.classList.remove('show');
        pwOverlay.classList.remove('error');
        pwInput.value = '';
        pwOverlay.classList.add('open');
        setTimeout(() => pwInput.focus(), 60);
      }

      function closePwModal() {
        pwOverlay.classList.remove('open', 'error');
        pwError.classList.remove('show');
        if (pwRedirectTimer) {
          clearTimeout(pwRedirectTimer);
          pwRedirectTimer = null;
        }
      }

      let pwBusy = false;

      function pwFail(msg) {
        pwInput.value = '';
        pwError.textContent = msg || 'Wrong password. Try again.';
        pwError.classList.add('show');
        pwOverlay.classList.remove('error');
        void pwOverlay.offsetWidth;
        pwOverlay.classList.add('error');
      }

      async function submitPw() {
        if (pwBusy) return;
        pwBusy = true;
        pwInput.disabled = true;
        try {
          const { data, error } = await db.rpc('verify_secret_password', { p_password: pwInput.value });
          if (error) throw error;
          if (data) {
            secretTokenSet(String(data));
            closePwModal();
            updateLockBtn();
            await loadSecretPhotos();
            location.hash = '#/zx7k9q';
          } else {
            pwFail();
          }
        } catch (e) {
          console.error(e);
          const tooMany = /too many/i.test(String(e && e.message));
          pwFail(tooMany
            ? 'Too many attempts. Wait 15 minutes and try again.'
            : 'Password check failed. Try again.');
        } finally {
          pwBusy = false;
          pwInput.disabled = false;
        }
      }

      function updateLockBtn() {
        const unlocked = !!secretToken();
        const btn = $('lock-btn');
        if (!btn) return;
        btn.classList.toggle('unlocked', unlocked);
        btn.textContent = unlocked ? '🔓' : '🔒';
        $('lock-label').textContent = unlocked ? 'Unlocked' : 'Secret';
      }

      $('lock-btn').addEventListener('click', openPwModal);
      $('pw-submit').addEventListener('click', submitPw);
      $('pw-cancel').addEventListener('click', closePwModal);
      pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitPw();
      });
      pwOverlay.addEventListener('click', (e) => {
        if (e.target === pwOverlay) closePwModal();
      });

      $('relock-btn').addEventListener('click', () => {
        secretTokenClear();
        updateLockBtn();
        location.hash = '#/home';
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeLightbox();
          closePwModal();
        }
      });

      /* ===== SECRET PHOTOS (private rows, only through token RPC) ===== */
      async function loadSecretPhotos() {
        const token = secretToken();
        if (!token) { loadedSecretPhotos = []; secretPhotos = []; buildSecret(); return; }
        try {
          const { data, error } = await db.rpc('get_secret_photos', { p_token: token });
          if (error) throw error;
          loadedSecretPhotos = (data || []).map(row => normalizePhoto(row));
          rebuildPhotoData();
        } catch (e) {
          console.warn('secret photos:', e);
          loadedSecretPhotos = [];
          secretPhotos = [];
          buildSecret();
          if (/locked|expired|invalid/i.test(String(e && e.message))) {
            secretTokenClear();
            updateLockBtn();
            if (location.hash.indexOf('zx7k9q') !== -1) location.hash = '#/home';
            showToast('secret session expired - enter the password again');
          }
        }
      }

      function buildSecret() {
        const grid = $('secret-grid');
        if (!grid) return;

        const hero = $('secret-photo-1');
        const heroPh = $('secret-hero-ph');
        const titleEl = $('secret-hero-title');
        const subEl = $('secret-hero-sub');
        const first = secretPhotos[0];

        if (first) {
          setPhoto(hero, first.img);
          hero.alt = first.title || 'Special photo';
          hero.hidden = false;
          if (heroPh) heroPh.hidden = true;
          if (titleEl) titleEl.textContent = textOverrides['secret.hero-title'] || first.title || 'Special Photo';
          if (subEl) {
            const sub = textOverrides['secret.hero-sub'] !== undefined
              ? textOverrides['secret.hero-sub']
              : (first.desc || '');
            subEl.textContent = sub;
            subEl.hidden = !sub;
          }
        } else {
          if (hero) { hero.hidden = true; hero.removeAttribute('src'); }
          if (heroPh) heroPh.hidden = false;
          if (titleEl) titleEl.textContent = textOverrides['secret.hero-title'] || 'Special Photo';
          if (subEl) {
            const sub = textOverrides['secret.hero-sub'] !== undefined
              ? textOverrides['secret.hero-sub']
              : 'unlock to view';
            subEl.textContent = sub;
            subEl.hidden = !sub;
          }
        }

        grid.innerHTML = '';
        secretPhotos.slice(1).forEach((p) => {
          const frame = document.createElement('div');
          frame.className = 'secret-frame';

          const img = document.createElement('img');
          setPhoto(img, p.img);
          img.alt = p.title || 'Secret photo';
          img.loading = 'lazy';
          img.decoding = 'async';
          attachPhotoRetry(img, p.img, 3);
          watchShimmer(img, frame);
          frame.appendChild(img);

          const cap = document.createElement('span');
          cap.className = 'secret-cap';
          cap.textContent = p.title || 'Photo';
          frame.appendChild(cap);
          if (p.id != null) {
            addPhotoStar(frame, p.id, 'secret');
            addPhotoDelete(frame, p.id);
          }
          grid.appendChild(frame);
        });

        refreshHeroStar(first ? first.id : null);

        const addBtn = $('secret-add-photo');
        if (addBtn) addBtn.hidden = !isOwner();
      }



      /* ===== FX BERAT: DIOFFKAN DI HP / DEVICE LEMAH ===== */
      const PERF_LITE = document.documentElement.classList.contains('perf-lite');
      const HEAVY_FX_OFF = PERF_LITE || !!(window.matchMedia &&
        window.matchMedia('(max-width: 640px), (pointer: coarse)').matches);
      let cursorGlowOn = !HEAVY_FX_OFF;

      // Adaptif: kalau frame rate masih rendah di laptop lemah, turunkan mode.
      if (!PERF_LITE) {
        setTimeout(() => {
          if (document.hidden) return;
          let frames = 0, t0 = 0, stopped = false;
          const sample = (t) => {
            if (stopped) return;
            if (!t0) t0 = t;
            frames++;
            if (t - t0 < 1200) { requestAnimationFrame(sample); return; }
            stopped = true;
            const fps = frames * 1000 / (t - t0);
            if (fps < 42) {
              document.documentElement.classList.add('perf-lite', 'perf-reduce');
              document.documentElement.dataset.autoLite = String(Math.round(fps));
              cursorGlowOn = false;
              const cg = document.querySelector('.cursor-glow');
              if (cg) cg.remove();
              try { toggleSparkles(false); toggleCarFx(false); } catch (e) { }
            }
          };
          requestAnimationFrame(sample);
        }, 2600);
      }

      /* ===== SPARKLES ===== */
      let sparkleTimer = null;
      const SPARKLE_ICONS = ['✦', '✧', '✩', '✨', '✵'];
      /* Matcha punya FX sendiri: daun & teh, bukan mobil & duit.
         Dipilih saat spawn, jadi ganti tema langsung kerasa tanpa reload. */
      const SPARKLE_LEAF = ['✦', '✧', '🍃', '🍵', '✵'];
      const fxMatcha = () => document.documentElement.getAttribute('data-theme') === 'matcha';

      function toggleSparkles(on) {
        /* Matcha nggak pakai FX melayang: identitasnya tenang, bukan pesta */
        if (HEAVY_FX_OFF || fxMatcha()) on = false;
        if (on && !sparkleTimer) {
          sparkleTimer = setInterval(() => {
            if (document.hidden) return;
            const icons = fxMatcha() ? SPARKLE_LEAF : SPARKLE_ICONS;
            const s = document.createElement('div');
            s.className = 'sparkle-fx';
            s.textContent = icons[Math.floor(Math.random() * icons.length)];
            s.style.left = Math.random() * window.innerWidth + 'px';
            s.style.top = Math.random() * window.innerHeight + 'px';
            s.style.fontSize = (11 + Math.random() * 16) + 'px';
            document.body.appendChild(s);
            setTimeout(() => s.remove(), 1600);
          }, 1400);
        } else if (!on && sparkleTimer) {
          clearInterval(sparkleTimer);
          sparkleTimer = null;
          document.querySelectorAll('.sparkle-fx').forEach(el => el.remove());
        }
      }

      let carTimer = null;
      const CASH_ICONS = ['💰', '💸', '💵', '8', '2', '1', '2', '0', '1', '1', '5'];
      const CASH_LEAF = ['🍃', '🌿', '🍵', '✦', '✧'];

      function spawnCar() {
        const s = document.createElement('div');
        s.className = 'car-fx car';
        s.textContent = fxMatcha() ? '🍃' : '🏎️';
        s.style.top = (12 + Math.random() * 72) + 'vh';
        s.style.animationDuration = (1.5 + Math.random() * 1.3) + 's';
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 3000);
      }

      function spawnCash() {
        const icons = fxMatcha() ? CASH_LEAF : CASH_ICONS;
        const s = document.createElement('div');
        s.className = 'car-fx cash';
        s.textContent = icons[Math.floor(Math.random() * icons.length)];
        s.style.left = (4 + Math.random() * 90) + 'vw';
        s.style.top = (12 + Math.random() * 68) + 'vh';
        s.style.fontSize = (18 + Math.random() * 20) + 'px';
        s.style.animationDuration = (1.3 + Math.random() * 0.9) + 's';
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 2600);
      }

      function toggleCarFx(on) {
        /* Matcha: no cars, no cash rain */
        if (HEAVY_FX_OFF || fxMatcha()) on = false;
        if (on && !carTimer) {
          carTimer = setInterval(() => {
            if (document.hidden) return;
            if (Math.random() < 0.4) spawnCar();
            else {
              spawnCash();
              if (Math.random() < 0.4) setTimeout(spawnCash, 260);
            }
          }, 1700);
        } else if (!on && carTimer) {
          clearInterval(carTimer);
          carTimer = null;
          document.querySelectorAll('.car-fx').forEach(el => el.remove());
        }
      }

      /* ===== HERO TITLE (draggable letters) ===== */
      (function initHeroTitle() {
        const titleEl = $('hero-title');
        const hero = document.querySelector('.hero');
        if (!titleEl || !hero) return;

        function splitLetters(node, accent) {
          const frag = document.createDocumentFragment();
          Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              child.textContent.split('').forEach((ch) => {
                if (ch === ' ') {
                  frag.appendChild(document.createTextNode(' '));
                  return;
                }
                const s = document.createElement('span');
                s.className = 'ht-letter' + (accent ? ' accent' : '');
                s.textContent = ch;
                frag.appendChild(s);
              });
            } else if (child.tagName === 'BR') {
              frag.appendChild(document.createElement('br'));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              frag.appendChild(splitLetters(child, accent || child.classList.contains('accent')));
            }
          });
          return frag;
        }

        const built = splitLetters(titleEl, false);
        titleEl.innerHTML = '';
        titleEl.appendChild(built);
        titleEl.querySelectorAll('.ht-letter').forEach((el, i) => el.style.setProperty('--i', i));

        let sweepTimer = null;
        titleEl.addEventListener('mouseenter', () => {
          if (sweepTimer) return;
          const letters = titleEl.querySelectorAll('.ht-letter');
          letters.forEach(el => {
            el.classList.remove('swipe');
            void el.offsetWidth;
            el.classList.add('swipe');
          });
          sweepTimer = setTimeout(() => {
            letters.forEach(el => el.classList.remove('swipe'));
            sweepTimer = null;
          }, letters.length * 55 + 700);
        });
      })();

      /* ===== CURSOR GLOW ===== */
      if (cursorGlowOn && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
        const cGlow = document.createElement('div');
        cGlow.className = 'cursor-glow';
        document.body.appendChild(cGlow);
        let gx = window.innerWidth / 2,
          gy = window.innerHeight / 2,
          cx = gx,
          cy = gy;
        window.addEventListener('pointermove', (e) => {
          if (!cursorGlowOn) return;
          gx = e.clientX;
          gy = e.clientY;
          cGlow.classList.add('on');
          if (!running) {
            running = true;
            requestAnimationFrame(followGlow);
          }
        });
        let running = false;
        function followGlow() {
          if (!cursorGlowOn) { running = false; return; }
          const dx = gx - cx,
            dy = gy - cy;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            cx = gx;
            cy = gy;
            cGlow.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
            running = false;
            return;
          }
          cx += dx * 0.15;
          cy += dy * 0.15;
          cGlow.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
          requestAnimationFrame(followGlow);
        }
      }

      /* ===========================
         NEW LAYER: MOTION, CLOCK, WALL, TIMER, EXTRAS
         =========================== */

      /* --- scroll reveal (dipanggil lagi buat elemen yang dibikin dinamis) --- */
      let revealObs = null;
      if ('IntersectionObserver' in window) {
        revealObs = new IntersectionObserver((ents) => {
          ents.forEach(en => {
            if (!en.isIntersecting) return;
            en.target.classList.add('is-in');
            revealObs.unobserve(en.target);
            if (en.target.hasAttribute('data-count-birth') ||
              en.target.hasAttribute('data-count-gallery') ||
              en.target.hasAttribute('data-count')) {
              countUp(en.target);
            }
            en.target.querySelectorAll('[data-count-birth],[data-count-gallery],[data-count]').forEach(countUp);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      }

      function observeReveals(root) {
        const scope = root || document;
        const els = scope.querySelectorAll('[data-reveal]');
        const groups = new Map();
        els.forEach(el => {
          if (el.dataset.rvDone === '1') return;
          el.dataset.rvDone = '1';
          const p = el.parentElement;
          const n = groups.get(p) || 0;
          groups.set(p, n + 1);
          if (!revealObs) { el.classList.add('is-in'); return; }
          if (n > 0) el.style.setProperty('--rv-d', Math.min(n * 85, 420) + 'ms');
          revealObs.observe(el);
        });
      }

      /* --- angka menghitung sendiri --- */
      function countUp(el) {
        if (el.dataset.counted === '1') return;
        el.dataset.counted = '1';
        let target = 0;
        if (el.hasAttribute('data-count-birth')) {
          const b = new Date(el.getAttribute('data-count-birth'));
          const now = new Date();
          target = now.getFullYear() - b.getFullYear();
          const m = now.getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < b.getDate())) target--;
        } else if (el.hasAttribute('data-count-gallery')) {
          target = GALLERY.length;
        } else {
          target = parseInt(el.getAttribute('data-count') || '0', 10) || 0;
        }
        const dur = 1100;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * e);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target;
        };
        requestAnimationFrame(step);
      }

      /* --- jam real-time WIB / WITA / WIT --- */
      const INDO_ZONES = [
        { key: 'wib', tz: 'Asia/Jakarta', offset: 7 },
        { key: 'wita', tz: 'Asia/Makassar', offset: 8 },
        { key: 'wit', tz: 'Asia/Jayapura', offset: 9 }
      ];

      function clockText(zone) {
        try {
          return new Date().toLocaleTimeString('en-GB', {
            timeZone: zone.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          });
        } catch (e) {
          const d = new Date(Date.now() + (zone.offset * 60 + new Date().getTimezoneOffset()) * 60000);
          return String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0');
        }
      }

      function tickClock() {
        INDO_ZONES.forEach(zone => {
          const s = clockText(zone);
          const ids = zone.key === 'wib'
            ? ['hero-clock', 'footer-clock', 'drawer-clock']
            : ['hero-clock-' + zone.key, 'footer-clock-' + zone.key, 'drawer-clock-' + zone.key];
          ids.forEach(id => {
            const el = $(id);
            if (el) el.textContent = s;
          });
        });
      }
      tickClock();
      setInterval(tickClock, 1000);

      /* --- toast --- */
      let toastTimer = 0;
      function showToast(msg) {
        const t = $('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
      }

      /* --- copy email / nomor --- */
      async function copyText(txt) {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(txt);
            return true;
          }
        } catch (e) { }
        try {
          const ta = document.createElement('textarea');
          ta.value = txt;
          ta.style.cssText = 'position:fixed;opacity:0;top:0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (e) { return false; }
      }
      document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-copy]');
        if (!btn) return;
        const ok = await copyText(btn.getAttribute('data-copy'));
        if (!ok) { showToast('copy blocked — long press instead'); return; }
        showToast('copied ✓');
        btn.classList.add('done');
        const isLabel = btn.classList.contains('contact-copy') || btn.classList.contains('footer-copy');
        const orig = btn.textContent;
        if (isLabel) btn.textContent = 'copied!';
        setTimeout(() => {
          btn.classList.remove('done');
          if (isLabel) btn.textContent = orig;
        }, 1600);
      });

      /* --- scroll progress + back to top (rAF, transform doang) --- */
      const toTopBtn = $('to-top');
      const progressEl = $('scroll-progress');
      let scrollQueued = false;
      function paintScrollUI() {
        scrollQueued = false;
        const st = window.scrollY || document.documentElement.scrollTop;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progressEl) {
          const ratio = max > 0 ? Math.min(1, Math.max(0, st / max)) : 0;
          progressEl.style.transform = 'scaleX(' + ratio + ')';
        }
        if (toTopBtn) toTopBtn.classList.toggle('show', st > 520);
      }
      function onScrollUI() {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(paintScrollUI);
      }
      window.addEventListener('scroll', onScrollUI, { passive: true });
      window.addEventListener('resize', onScrollUI, { passive: true });
      paintScrollUI();
      if (toTopBtn) {
        toTopBtn.addEventListener('click', () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      /* --- scroll-to tombol --- */
      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-scroll-to]');
        if (!t) return;
        const el = document.querySelector(t.getAttribute('data-scroll-to'));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      /* --- burger + drawer --- */
      const burgerBtn = $('nav-burger');
      const drawerEl = $('nav-drawer');
      function openDrawer() {
        if (!drawerEl) return;
        drawerEl.classList.add('open');
        burgerBtn.classList.add('on');
        burgerBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('menu-open');
        document.documentElement.classList.add('menu-open');
        tickClock();
      }
      function closeDrawer() {
        if (!drawerEl) return;
        drawerEl.classList.remove('open');
        burgerBtn.classList.remove('on');
        burgerBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
        document.documentElement.classList.remove('menu-open');
      }
      if (burgerBtn) {
        burgerBtn.addEventListener('click', () => {
          if (drawerEl.classList.contains('open')) closeDrawer();
          else openDrawer();
        });
      }
      if (drawerEl) {
        drawerEl.addEventListener('click', (e) => {
          if (e.target === drawerEl || e.target.closest('a')) closeDrawer();
        });
      }
      window.addEventListener('resize', () => {
        if (window.innerWidth > 760) closeDrawer();
      });

      /* --- strip foto di home --- */
      function buildHomeShots() {
        const wrap = $('home-shots');
        if (!wrap) return;
        const picks = [0, 5, 3, 6, 10, Math.max(14, GALLERY.length - 1)]
          .filter((v, i, a) => a.indexOf(v) === i);
        wrap.innerHTML = '';
        picks.forEach(idx => {
          const item = GALLERY[idx];
          if (!item) return;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'shot';
          b.setAttribute('data-reveal', '');
          const img = document.createElement('img');
          setPhoto(img, item.img);
          img.alt = item.title;
          img.loading = 'lazy';
          img.decoding = 'async';
          attachPhotoRetry(img, item.img, 4);
          watchShimmer(img, b);
          const tag = document.createElement('span');
          tag.className = 'shot-tag';
          tag.textContent = (CAT_LABEL[item.cat] || 'Photo').toUpperCase();
          const cap = document.createElement('span');
          cap.className = 'shot-cap';
          const bt = document.createElement('b');
          bt.textContent = item.title;
          const it = document.createElement('i');
          it.textContent = item.desc || 'tap to view';
          cap.appendChild(bt);
          cap.appendChild(it);
          b.appendChild(img);
          b.appendChild(tag);
          b.appendChild(cap);
          b.addEventListener('click', () => openLightboxAt(GALLERY, idx));
          wrap.appendChild(b);
        });
        const cnt = $('shots-count');
        if (cnt) cnt.textContent = GALLERY.length;
        // grid ini di-rebuild tiap data foto dari Supabase berubah, jadi item
        // baru wajib didaftarkan lagi ke observer reveal — kalau nggak,
        // kartunya tetap opacity 0 (foto kelihatan "hilang").
        observeReveals(wrap);
      }

      /* --- marquee: diulang sampai memenuhi layar, lalu digandakan biar mulus --- */
      function buildMarquee() {
        const track = $('marquee-track');
        if (!track) return;
        const wrap = track.closest('.marquee') || track.parentElement;
        const ITEM = 'Photography <i>✦</i> Languages <i>✦</i> Rubik\'s Cube <i>✦</i> ' +
          'Games <i>✦</i> Drawing <i>✦</i> Bandung <i>✦</i> ';

        const group = document.createElement('div');
        group.className = 'marquee-half';
        group.innerHTML = '<span>' + ITEM + '</span>';
        track.innerHTML = '';
        track.appendChild(group);

        const unit = group.firstElementChild;
        const unitW = unit ? unit.getBoundingClientRect().width : 600;
        const viewW = Math.max(320, wrap ? wrap.clientWidth : window.innerWidth);
        const copies = Math.max(1, Math.ceil(viewW / Math.max(200, unitW)) + 1);

        let html = '';
        for (let i = 0; i < copies; i++) html += '<span>' + ITEM + '</span>';
        group.innerHTML = html;

        const clone = group.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);

        // Satu putaran = lebar satu half; kecepatan dibuat konsisten (~55px/s).
        const halfW = group.getBoundingClientRect().width || viewW;
        track.style.animationDuration = Math.max(16, Math.round(halfW / 55)) + 's';
      }

      let marqueeRaf = 0;
      window.addEventListener('resize', () => {
        cancelAnimationFrame(marqueeRaf);
        marqueeRaf = requestAnimationFrame(buildMarquee);
      });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => buildMarquee()).catch(() => { });
      }

      /* --- tombol yang buka modal feedback --- */
      ['cta-feedback'].forEach(id => {
        const b = $(id);
        if (b) b.addEventListener('click', () => {
          const target = $('fb-open');
          if (target) target.click();
        });
      });

      /* --- timer Rubik --- */
      const RB_KEY = 'rv-solves-v1';
      const rbTime = $('rb-time'), rbBtn = $('rb-btn'), rbBest = $('rb-best'),
        rbAo5 = $('rb-ao5'), rbCount = $('rb-count'), rbSess = $('rb-sessions'),
        rbClear = $('rb-clear');
      let rbRunning = false, rbStart = 0, rbRaf = 0;
      let rbArmed = false, rbArmTimer = 0;
      const RB_ARM_MS = 300; // tahan Space ~0.3s dulu, baru hijau & siap start
      let rbSolves = [];
      try { rbSolves = JSON.parse(localStorage.getItem(RB_KEY) || '[]'); if (!Array.isArray(rbSolves)) rbSolves = []; } catch (e) { rbSolves = []; }

      /* --- scramble 3x3: 20 gerakan, disimpan biar nggak ganti tiap reload --- */
      const RB_SCRAMBLE_KEY = 'rv-scramble-v1';
      const rbScramble = $('rb-scramble');
      const rbScrambleNew = $('rb-scramble-new');
      const rbScrambleCopy = $('rb-scramble-copy');
      const SCRAMBLE_FACES = ['R', 'L', 'U', 'D', 'F', 'B'];
      const SCRAMBLE_MODS = ['', "'", '2'];
      const SCRAMBLE_AXIS = { R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' };

      function makeScramble(len) {
        const count = len || 20;
        const moves = [];
        while (moves.length < count) {
          const face = SCRAMBLE_FACES[Math.floor(Math.random() * 6)];
          const n = moves.length;
          if (n && face === moves[n - 1].face) continue;
          // hindari 3 gerakan sejajar (R L R) biar scramble-nya wajar
          if (n >= 2 &&
            SCRAMBLE_AXIS[face] === SCRAMBLE_AXIS[moves[n - 1].face] &&
            SCRAMBLE_AXIS[face] === SCRAMBLE_AXIS[moves[n - 2].face]) continue;
          moves.push({
            face: face,
            mod: SCRAMBLE_MODS[Math.floor(Math.random() * 3)]
          });
        }
        return moves.map(m => m.face + m.mod).join(' ');
      }

      function paintScramble(text) {
        if (!rbScramble) return;
        rbScramble.textContent = text;
        rbScramble.dataset.scramble = text;
      }

      function newScramble(silent) {
        const text = makeScramble(20);
        paintScramble(text);
        try { localStorage.setItem(RB_SCRAMBLE_KEY, text); } catch (e) { }
        if (!silent) showToast('new scramble ready');
        return text;
      }

      function currentScramble() {
        if (!rbScramble) return '';
        return (rbScramble.dataset.scramble || rbScramble.textContent || '').trim();
      }

      async function copyScramble() {
        const txt = currentScramble();
        if (!txt) return;
        const ok = await copyText(txt);
        if (!ok) { showToast('copy blocked — long press the scramble'); return; }
        showToast('scramble copied ✓');
        if (rbScramble) {
          rbScramble.classList.add('copied');
          setTimeout(() => rbScramble.classList.remove('copied'), 900);
        }
      }

      (function initScramble() {
        if (!rbScramble) return;
        let saved = '';
        try { saved = localStorage.getItem(RB_SCRAMBLE_KEY) || ''; } catch (e) { }
        if (!saved || saved.split(/\s+/).length < 10) {
          saved = makeScramble(20);
          try { localStorage.setItem(RB_SCRAMBLE_KEY, saved); } catch (e) { }
        }
        paintScramble(saved);
      })();

      if (rbScrambleNew) {
        rbScrambleNew.addEventListener('click', () => {
          newScramble();
          rbScrambleNew.blur(); // biar Space langsung dipakai timer lagi
        });
      }
      if (rbScrambleCopy) {
        rbScrambleCopy.addEventListener('click', () => {
          copyScramble();
          rbScrambleCopy.blur();
        });
      }
      if (rbScramble) {
        rbScramble.addEventListener('click', () => {
          copyScramble();
          rbScramble.blur();
        });
      }

      function fmtMs(ms) {
        const s = ms / 1000;
        if (s < 60) return s.toFixed(2);
        const m = Math.floor(s / 60);
        const r = (s - m * 60);
        return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
      }
      function rbAverageOf(n) {
        if (rbSolves.length < n) return null;
        const slice = rbSolves.slice(-n).slice().sort((a, b) => a - b);
        const middle = slice.slice(1, -1);
        return middle.reduce((a, b) => a + b, 0) / middle.length;
      }

      function drawRbChart() {
        const canvas = $('rb-chart');
        if (!canvas) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = canvas.clientWidth || 320;
        const cssH = canvas.clientHeight || 96;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssW, cssH);

        const values = rbSolves.slice(-40);
        if (values.length < 2) return;
        const min = Math.min.apply(null, values);
        const max = Math.max.apply(null, values);
        const pad = 8;
        const span = Math.max(1, max - min);
        const x = (i) => pad + (i / (values.length - 1)) * (cssW - pad * 2);
        const y = (v) => pad + ((v - min) / span) * (cssH - pad * 2);

        ctx.beginPath();
        values.forEach((v, i) => {
          if (i === 0) ctx.moveTo(x(i), y(v));
          else ctx.lineTo(x(i), y(v));
        });
        ctx.strokeStyle = 'rgba(216, 180, 90, 0.85)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.lineTo(x(values.length - 1), cssH - pad);
        ctx.lineTo(x(0), cssH - pad);
        ctx.closePath();
        ctx.fillStyle = 'rgba(216, 180, 90, 0.12)';
        ctx.fill();

        const last = values[values.length - 1];
        ctx.beginPath();
        ctx.arc(x(values.length - 1), y(last), 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f0d38e';
        ctx.fill();
      }

      function rbPaint() {
        if (!rbSess) return;
        rbCount.textContent = rbSolves.length;
        const best = rbSolves.length ? Math.min.apply(null, rbSolves) : null;
        const worst = rbSolves.length ? Math.max.apply(null, rbSolves) : null;
        rbBest.textContent = best != null ? fmtMs(best) : '—';
        if ($('rb-worst')) $('rb-worst').textContent = worst != null ? fmtMs(worst) : '—';

        const ao5v = rbAverageOf(5);
        const ao12v = rbAverageOf(12);
        const ao100v = rbAverageOf(100);
        rbAo5.textContent = ao5v != null ? fmtMs(ao5v) : '—';
        if ($('rb-ao12')) $('rb-ao12').textContent = ao12v != null ? fmtMs(ao12v) : '—';
        if ($('rb-ao100')) $('rb-ao100').textContent = ao100v != null ? fmtMs(ao100v) : '—';

        if ($('rb-mean')) {
          const mean = rbSolves.length ? rbSolves.reduce((a, b) => a + b, 0) / rbSolves.length : null;
          $('rb-mean').textContent = mean != null ? fmtMs(mean) : '—';
        }

        const shown = rbSolves.slice(-12).reverse();
        if (!shown.length) {
          rbSess.innerHTML = '<li class="timer-empty">no solves yet — go warm up your hands</li>';
          rbClear.hidden = true;
          drawRbChart();
          return;
        }
        rbClear.hidden = false;
        const showBest = Math.min.apply(null, shown);
        rbSess.innerHTML = shown.map(v =>
          '<li' + (v === showBest ? ' class="best"' : '') + '>' + fmtMs(v) + '</li>').join('');
        drawRbChart();
      }
      function rbTick() {
        rbTime.textContent = fmtMs(performance.now() - rbStart);
        rbRaf = requestAnimationFrame(rbTick);
      }
      function rbDisarm() {
        if (rbArmTimer) {
          clearTimeout(rbArmTimer);
          rbArmTimer = 0;
        }
        rbArmed = false;
        if (rbTime) rbTime.classList.remove('armed');
        if (rbBtn) {
          rbBtn.classList.remove('armed');
          if (!rbRunning) rbBtn.textContent = 'START';
        }
      }
      function rbArm() {
        if (!rbTime || rbRunning || rbArmed || rbArmTimer) return;
        if (!player.name) { needName(); return; }
        rbTime.classList.remove('run');
        rbTime.textContent = '0.00';
        // Hijau baru setelah ditahan sebentar — sama kayak csTimer.
        rbArmTimer = setTimeout(() => {
          rbArmTimer = 0;
          rbArmed = true;
          rbTime.classList.add('armed');
          rbBtn.classList.add('armed');
          rbBtn.textContent = 'READY';
        }, RB_ARM_MS);
      }
      function rbStartTimer() {
        if (rbRunning || !rbTime) return;
        if (!player.name) { needName(); return; }
        rbDisarm();
        rbRunning = true;
        rbStart = performance.now();
        rbTime.textContent = '0.00';
        rbTime.classList.add('run');
        rbTime.classList.remove('armed');
        rbBtn.textContent = 'STOP';
        rbBtn.classList.remove('armed');
        rbBtn.classList.add('stop');
        rbTick();
      }
      function rbStopTimer() {
        if (!rbRunning) return;
        rbRunning = false;
        cancelAnimationFrame(rbRaf);
        const ms = performance.now() - rbStart;
        rbTime.classList.remove('run');
        rbTime.textContent = fmtMs(ms);
        rbBtn.textContent = 'START';
        rbBtn.classList.remove('stop');
        rbBtn.classList.remove('armed');
        if (ms > 300) {
          const usedScramble = currentScramble();
          rbSolves.push(Math.round(ms));
          if (rbSolves.length > 200) rbSolves.shift();
          try { localStorage.setItem(RB_KEY, JSON.stringify(rbSolves)); } catch (e) { }
          rbPaint();
          showToast('solve ' + fmtMs(ms) + ' saved');
          submitScore(ms, usedScramble);
          newScramble(true); // siapin scramble berikutnya, kayak csTimer
        }
      }
      function rbArmRelease() {
        const ready = rbArmed;
        rbDisarm();
        if (ready) rbStartTimer();
      }
      function rbToggle() {
        if (!rbTime) return;
        if (rbRunning) rbStopTimer();
        else rbStartTimer();
      }
      if (rbBtn) rbBtn.addEventListener('click', rbToggle);
      if (rbClear) rbClear.addEventListener('click', () => {
        rbSolves = [];
        try { localStorage.removeItem(RB_KEY); } catch (e) { }
        rbPaint();
        showToast('history cleared');
      });

      function isSpaceKey(e) {
        return e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      }
      function timerHot() {
        if (!rbTime || !rbTime.offsetParent) return false;
        if ($('lightbox').classList.contains('open')) return false;
        if ($('pw-overlay').classList.contains('open')) return false;
        if ($('fb-overlay').classList.contains('open')) return false;
        return true;
      }
      function spaceTyping(e) {
        if (e.target === rbBtn) return false; // tombol timer tetap ikut aturan Space
        const tag = (e.target.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' ||
          tag === 'button' || e.target.isContentEditable;
      }
      document.addEventListener('keydown', (e) => {
        if (!isSpaceKey(e) || spaceTyping(e) || !timerHot()) return;
        e.preventDefault();
        if (e.repeat) return;
        if (rbRunning) { rbStopTimer(); return; } // jalan -> Space langsung stop
        rbArm();                                   // diam -> tahan dulu buat arm
      });
      document.addEventListener('keyup', (e) => {
        if (!isSpaceKey(e) || spaceTyping(e) || !timerHot()) return;
        if (rbRunning) return;
        if (!rbArmed && !rbArmTimer) return;       // cuma kalau tadi beneran arm
        e.preventDefault();
        rbArmRelease();                            // lepas -> start
      });
      window.addEventListener('blur', rbDisarm);
      window.addEventListener('hashchange', rbDisarm);
      if (rbTime) rbPaint();

      /* --- nama pemain + leaderboard publik --- */
      const PLAYER_KEY = 'rv-player-v1';
      const RB_BENCH_MS = 13950;
      let player = { id: '', name: '' };
      try {
        const savedPlayer = JSON.parse(localStorage.getItem(PLAYER_KEY) || '{}');
        if (savedPlayer && typeof savedPlayer === 'object') {
          player.id = savedPlayer.id || '';
          player.name = savedPlayer.name || '';
        }
      } catch (e) { }

      if (!player.id) {
        player.id = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      }
      try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); } catch (e) { }

      const rbName = $('rb-name'), rbNameSave = $('rb-name-save'), rbNameHint = $('rb-name-hint');
      if (rbName && player.name) rbName.value = player.name;
      if (rbNameHint && player.name) {
        rbNameHint.textContent = 'Playing as ' + player.name + ' — your best run is on the board.';
        rbNameHint.classList.add('ok');
      }

      let lbRows = [];
      let lbOffline = false;
      let lbLoaded = false;
      let lbNoScramble = false;
      const BENCH_SCRAMBLE = "R U2 F' L D2 R' B U' F2 D L2 U' R2 B' D2 F U2 L' B2 R'";

      function needName() {
        showToast('set your name first — leaderboard needs it');
        if (rbName) {
          rbName.classList.add('need');
          rbName.focus();
          setTimeout(() => rbName.classList.remove('need'), 1200);
        }
      }

      function setPlayerName(raw) {
        const name = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 20);
        if (!name) { needName(); return false; }
        player.name = name;
        try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); } catch (e) { }
        if (rbName) rbName.value = name;
        if (rbNameHint) {
          rbNameHint.textContent = 'Playing as ' + name + ' — your best run is on the board.';
          rbNameHint.classList.add('ok');
        }
        showToast('name saved · ' + name);
        const mine = lbRows.find(r => r.player_id === player.id);
        const best = rbSolves.length ? Math.min.apply(null, rbSolves) : (mine ? mine.best_ms : null);
        if (best) submitScore(best);
        return true;
      }

      if (rbNameSave) rbNameSave.addEventListener('click', () => setPlayerName(rbName.value));
      if (rbName) rbName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); setPlayerName(rbName.value); }
      });

      async function loadLeaderboard() {
        const list = $('lb-list');
        if (!list) return;
        try {
          let res;
          if (lbNoScramble) {
            // sesi ini udah tahu kolomnya belum ada -> jangan spam request 400
            res = await db.from('rubik_scores')
              .select('player_id,name,best_ms')
              .order('best_ms', { ascending: true })
              .limit(50);
          } else {
            res = await db.from('rubik_scores')
              .select('player_id,name,best_ms,scramble')
              .order('best_ms', { ascending: true })
              .limit(50);
            // Kolom scramble belum ada -> tetap tampilkan board lama.
            if (res.error && /scramble|PGRST204|column|schema cache/i.test(String(res.error.message || ''))) {
              lbNoScramble = true;
              res = await db.from('rubik_scores')
                .select('player_id,name,best_ms')
                .order('best_ms', { ascending: true })
                .limit(50);
            }
          }
          if (res.error) throw res.error;
          lbRows = (res.data || []).map(r => ({
            player_id: r.player_id, name: r.name, best_ms: Number(r.best_ms) || 0,
            scramble: r.scramble ? String(r.scramble) : '',
            virtual: false
          }));
          lbOffline = false;
        } catch (e) {
          lbRows = [];
          lbOffline = true;
        }
        // benchmark 13.95s selalu ada, walaupun seed SQL belum jalan.
        // Cek player_id, bukan nama — pemain lain boleh saja bernama "excel".
        const hasBench = lbRows.some(r => r.player_id === 'excel');
        if (!hasBench) lbRows.push({
          player_id: 'excel', name: 'excel', best_ms: RB_BENCH_MS,
          scramble: BENCH_SCRAMBLE, virtual: true
        });
        // baris benchmark dari DB lama boleh pakai scramble seed biar tampil lengkap
        lbRows.forEach(r => {
          if (r.player_id === 'excel' && !r.scramble && !lbNoScramble) r.scramble = BENCH_SCRAMBLE;
        });
        lbRows.sort((a, b) => a.best_ms - b.best_ms);
        lbLoaded = true;
        renderLeaderboard();
      }

      function renderLeaderboard() {
        const list = $('lb-list'), status = $('lb-status');
        if (!list) return;
        if (!lbLoaded) {
          if (status) status.textContent = 'loading…';
          list.setAttribute('aria-busy', 'true');
          list.innerHTML = new Array(4).fill(
            '<li class="lb-row lb-skel" aria-hidden="true">' +
            '<span class="lb-sk lb-sk-rank"></span>' +
            '<span class="lb-sk lb-sk-name"></span>' +
            '<span class="lb-sk lb-sk-time"></span></li>'
          ).join('');
          return;
        }
        list.removeAttribute('aria-busy');
        if (status) {
          status.textContent = lbOffline ? 'offline' : 'live';
          status.classList.toggle('off', lbOffline);
        }
        const beatEl = $('lb-beat');
        if (beatEl) {
          const bench = lbRows.find(r => r.player_id === 'excel');
          beatEl.textContent = fmtMs(bench ? bench.best_ms : RB_BENCH_MS) + 's';
        }
        if (!lbRows.length) {
          list.innerHTML = '<li class="lb-empty">No times yet — be the first.</li>';
          return;
        }
        const html = [];
        const myRank = lbRows.findIndex(r => r.player_id === player.id);
        const rowHtml = (r, i, mine) => {
          const rank = i + 1;
          const canDel = isOwner() && !r.virtual;
          const cls = 'lb-row' + (mine ? ' lb-you' : '') + (rank === 1 ? ' lb-top1' : '') +
            (canDel ? ' has-del' : '');
          const isBench = r.player_id === 'excel';
          const scrambleLine = rank <= 10
            ? (r.scramble
              ? '<span class="lb-scramble"><i>scramble</i>' + escHtml(r.scramble) + '</span>'
              : (lbNoScramble ? '' : '<span class="lb-scramble"><i>scramble</i>not recorded yet</span>'))
            : '';
          return '<li class="' + cls + '">' +
            '<span class="lb-rank">' + rank + '</span>' +
            '<span class="lb-name">' + escHtml(r.name) +
            (isBench ? ' <i class="lb-tag">record</i>' : '') +
            (mine ? ' <i class="lb-tag lb-tag-you">you</i>' : '') +
            '</span>' +
            '<span class="lb-time">' + fmtMs(r.best_ms) + 's</span>' +
            (canDel
              ? '<button type="button" class="lb-del" data-player="' +
              escHtml(r.player_id).replace(/"/g, '&quot;') + '" data-name="' +
              escHtml(r.name).replace(/"/g, '&quot;') +
              '" title="Delete score" aria-label="Delete score">×</button>'
              : '') +
            scrambleLine +
            '</li>';
        };
        lbRows.slice(0, 15).forEach((r, i) => {
          html.push(rowHtml(r, i, r.player_id === player.id));
        });
        if (myRank >= 15) {
          html.push('<li class="lb-gap">⋯</li>');
          html.push(rowHtml(lbRows[myRank], myRank, true));
        }
        list.innerHTML = html.join('');
      }

      window.__lbRender = renderLeaderboard;

      async function deleteRubikScore(id, name) {
        if (!isOwner()) return false;
        if (!confirm('Remove ' + (name || 'this player') + ' from the leaderboard?')) return false;
        try {
          const { error } = await db.rpc('admin_delete_rubik_score', {
            p_player_id: id
          });
          if (error) throw error;
          showToast('score removed');
          await loadLeaderboard();
          return true;
        } catch (e) {
          console.warn('delete score:', e);
          showToast('could not delete score');
          return false;
        }
      }

      if ($('lb-list')) {
        $('lb-list').addEventListener('click', (e) => {
          const btn = e.target.closest('.lb-del');
          if (!btn) return;
          e.stopPropagation();
          deleteRubikScore(btn.dataset.player, btn.dataset.name);
        });
      }

      async function submitScore(ms, scramble) {
        if (!player.name || !ms) return false;
        try {
          const res = await db.rpc('submit_rubik_score', {
            p_player_id: player.id,
            p_name: player.name,
            p_best_ms: Math.round(ms),
            p_scramble: scramble ? String(scramble).slice(0, 80) : null
          });
          if (res.error) throw res.error;
          await loadLeaderboard();
          return true;
        } catch (e) {
          console.warn('leaderboard submit:', e);
          showToast(lbOffline ? 'leaderboard offline' : 'could not save to leaderboard');
          return false;
        }
      }

      /* --- realtime: teks & leaderboard update tanpa reload --- */
      function initRealtimeBoard() {
        try {
          db.channel('rv-site-content')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, (payload) => {
              const row = payload.new;
              if (!row || !row.key || editingText) return;
              const val = String(row.value == null ? '' : row.value).trim();
              if (row.key === 'featured.gallery') {
                featuredGalleryId = val;
                rebuildPhotoData();
                return;
              }
              if (row.key === 'featured.secret') {
                featuredSecretId = val;
                rebuildPhotoData();
                return;
              }
              if (!val) return;
              textOverrides[row.key] = val;
              document.querySelectorAll('[data-edit]').forEach(el => {
                if (el.dataset.edit === row.key) el.textContent = val;
              });
            })
            .subscribe();
          db.channel('rv-rubik-lb')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rubik_scores' }, () => {
              loadLeaderboard();
            })
            .subscribe();
          db.channel('rv-gallery-photos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, () => {
              loadPhotos();
            })
            .subscribe();
        } catch (e) { }
      }

      /* --- lightbox: panah, keyboard, swipe --- */
      const lbPrev = $('lb-prev'), lbNext = $('lb-next'), lbBox = $('lightbox');
      if (lbPrev) lbPrev.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(-1); });
      if (lbNext) lbNext.addEventListener('click', (e) => { e.stopPropagation(); stepLightbox(1); });
      document.addEventListener('keydown', (e) => {
        if (!lbBox || !lbBox.classList.contains('open')) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
      });
      if (lbBox) {
        let tx = 0, ty = 0;
        lbBox.addEventListener('touchstart', (e) => {
          tx = e.changedTouches[0].clientX;
          ty = e.changedTouches[0].clientY;
        }, { passive: true });
        lbBox.addEventListener('touchend', (e) => {
          const dx = e.changedTouches[0].clientX - tx;
          const dy = e.changedTouches[0].clientY - ty;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx < 0 ? 1 : -1);
        }, { passive: true });
      }

      /* ===== INIT ===== */
      /* --- tema: Aventador (default) / Matcha "clover" --- */
      const THEME_KEY = 'rv-theme-v1';
      const THEME_USED_KEY = 'rv-theme-used-v1';
      const MATCHA_FONT_HREF = '';
      const MATCHA_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23c9dcb0'/%3E%3Cg transform='scale(2)'%3E%3Cpath d='M16 15.4C13.6 10 5.6 10.6 5.6 15.2c0 2.3 1.8 4.1 4.1 4.1-2.3 0-4.1 1.8-4.1 4.1 0 4.6 8 5.2 10.4-.2 2.4 5.4 10.4 4.8 10.4.2 0-2.3-1.8-4.1-4.1-4.1 2.3 0 4.1-1.8 4.1-4.1 0-4.6-8-5.2-10.4.2Z' fill='%233f7d4e'/%3E%3C/g%3E%3C/svg%3E";
      const ORNAMENT_SEL = '.hero-badge, .page-badge, .sec-eyebrow, .scramble-label, .rate-pop-badge';
      const themeSwitch = $('theme-switch');
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      const schemeMeta = document.querySelector('meta[name="color-scheme"]');
      const faviconEl = document.querySelector('link[rel="icon"]');
      const faviconLambo = faviconEl ? faviconEl.getAttribute('href') : '';

      function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'matcha' ? 'matcha' : 'lambo';
      }

      function ensureMatchaFont() {
        // Font matcha memakai Plus Jakarta Sans yang sudah self-hosted.
      }

      /* Badge pakai ikon clover CSS di matcha, jadi glyph ✦ dibuang.
         Footer dapat edisi yang sesuai tema. */
      function applyThemeCopy() {
        const matcha = currentTheme() === 'matcha';
        document.querySelectorAll(ORNAMENT_SEL).forEach((el) => {
          const rest = el.textContent.replace(/^\s*[✦☘🍀]\s*/, '');
          el.textContent = matcha ? rest : '✦ ' + rest;
        });
        const edition = $('footer-edition');
        if (edition) edition.textContent = matcha ? 'Matcha Edition' : 'Red Velvet Edition';
        if (faviconEl && faviconLambo) {
          faviconEl.setAttribute('href', matcha ? MATCHA_FAVICON : faviconLambo);
        }
      }

      function remeasureNav() {
        const run = () => {
          if (typeof queueNavIndicator === 'function') queueNavIndicator();
          else if (typeof moveNavIndicator === 'function') moveNavIndicator();
        };
        run();
        // link masih di-transition 0.22s waktu tema diganti -> ukur lagi
        // setelah geometrinya diam, biar pill nggak nyangkut di ukuran lama
        setTimeout(run, 280);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
      }

      function syncThemeUI() {
        const t = currentTheme();
        if (themeSwitch) {
          themeSwitch.setAttribute('aria-checked', t === 'matcha' ? 'true' : 'false');
          themeSwitch.setAttribute('aria-label', t === 'matcha'
            ? 'Theme: Matcha. Switch to Aventador'
            : 'Theme: Aventador. Switch to Matcha');
        }
        if (themeMeta) themeMeta.setAttribute('content', t === 'matcha' ? '#c9dcb0' : '#0a0a0c');
        if (schemeMeta) schemeMeta.setAttribute('content', t === 'matcha' ? 'light' : 'dark');
        if (t === 'matcha') ensureMatchaFont();
        applyThemeCopy();
      }

      function setTheme(name, announce) {
        const t = name === 'matcha' ? 'matcha' : 'lambo';
        if (t === 'matcha') document.documentElement.setAttribute('data-theme', 'matcha');
        else document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
        syncThemeUI();
        remeasureNav();
        // FX cuma hidup di Aventador; begitu balik lagi, nyalain sesuai view
        try {
          if (t === 'matcha') {
            toggleSparkles(false);
            toggleCarFx(false);
          } else if (document.body) {
            const v = document.body.dataset.view;
            toggleSparkles(v === 'profil' || v === 'hobi');
            toggleCarFx(v === 'home');
          }
        } catch (e) { }
        if (announce) {
          const lite = document.documentElement.classList.contains('perf-lite');
          const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!lite && !calm && document.body) {
            document.body.classList.remove('theme-swapping');
            void document.body.offsetWidth;
            document.body.classList.add('theme-swapping');
            setTimeout(() => document.body.classList.remove('theme-swapping'), 320);
          }
          showToast(t === 'matcha' ? 'matcha theme' : 'aventador theme');
        }
      }

      if (themeSwitch) {
        themeSwitch.addEventListener('click', () => {
          try { localStorage.setItem(THEME_USED_KEY, '1'); } catch (e) { }
          setTheme(currentTheme() === 'matcha' ? 'lambo' : 'matcha', true);
          updateThemePopCopy();
          hideThemePop(0);
          themeSwitch.blur(); // Space tetap dipakai timer rubik
        });
      }
      syncThemeUI();

      /* --- popup tema: muncul 5 detik setelah halaman kelihatan --- */
      const THEME_POP_KEY = 'rv-theme-pop-v1';
      const themePop = $('theme-pop');
      const themePopCta = $('theme-pop-cta');
      let themePopShown = false;

      function themeWasUsed() {
        try { return localStorage.getItem(THEME_USED_KEY) === '1'; } catch (e) { return false; }
      }

      function themePopSnoozed() {
        try {
          const until = Number(localStorage.getItem(THEME_POP_KEY) || 0);
          return !!(until && Date.now() < until);
        } catch (e) { return false; }
      }

      function canShowThemePop() {
        if (!themePop || themePopShown || themeWasUsed() || themePopSnoozed()) return false;
        if (document.body.classList.contains('editing-text')) return false;
        if (document.body.dataset.view === 'zx7k9q') return false;
        if (isOwner()) return false;
        const boxes = ['fb-overlay', 'own-overlay', 'pw-overlay', 'lightbox', 'nav-drawer', 'rate-pop'];
        for (let i = 0; i < boxes.length; i++) {
          const el = $(boxes[i]);
          if (el && (el.classList.contains('open') || el.classList.contains('show'))) return false;
        }
        return true;
      }

      function updateThemePopCopy() {
        if (!themePopCta) return;
        themePopCta.textContent = currentTheme() === 'matcha'
          ? 'Switch to Aventador'
          : 'Try Matcha theme';
      }

      function showThemePop() {
        if (!canShowThemePop()) return;
        themePopShown = true;
        updateThemePopCopy();
        themePop.classList.add('show');
        themePop.inert = false;
        themePop.setAttribute('aria-hidden', 'false');
      }

      function hideThemePop(days) {
        if (!themePop) return;
        themePop.classList.remove('show');
        themePop.inert = true;
        themePop.setAttribute('aria-hidden', 'true');
        if (days) {
          try { localStorage.setItem(THEME_POP_KEY, String(Date.now() + days * 86400000)); } catch (e) { }
        }
      }

      if (themePopCta) {
        themePopCta.addEventListener('click', () => {
          try { localStorage.setItem(THEME_USED_KEY, '1'); } catch (e) { }
          setTheme(currentTheme() === 'matcha' ? 'lambo' : 'matcha', true);
          hideThemePop(0);
        });
      }
      if ($('theme-pop-close')) {
        $('theme-pop-close').addEventListener('click', () => hideThemePop(7));
      }
      if ($('theme-pop-later')) {
        $('theme-pop-later').addEventListener('click', () => hideThemePop(7));
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && themePop && themePop.classList.contains('show')) hideThemePop(7);
      });

      let themeDwell = 0;
      const themeDwellTimer = setInterval(() => {
        if (themePopShown || themeWasUsed() || themePopSnoozed()) {
          clearInterval(themeDwellTimer);
          return;
        }
        if (document.hidden) return;
        themeDwell += 1;
        if (themeDwell >= 5 && canShowThemePop()) {
          clearInterval(themeDwellTimer);
          showThemePop();
        }
      }, 1000);

      // Media statis di HTML juga dikasih jaring pengaman
      attachImgRetry($('avatar-img'), 6);
      document.querySelectorAll('.contact-icon').forEach(el => attachImgRetry(el, 6));
      document.querySelectorAll('img[data-local-src]').forEach(el => attachImgRetry(el, 6));
      document.querySelectorAll('.about-frame > img, .avatar-frame > img')
        .forEach(img => watchShimmer(img, img.parentElement));
      document.querySelectorAll('img.contact-icon').forEach(img => watchShimmer(img, img));
      if ($('secret-photo-1')) watchShimmer($('secret-photo-1'), $('secret-photo-1'));
      buildTrackList();
      rebuildPhotoData();
      buildMarquee();
      syncOwnerUI();
      updateLockBtn();
      refreshOwner();
      route();
      observeReveals();
      loadLeaderboard();
      loadSiteContent();
      loadPhotos();
      if (secretToken()) loadSecretPhotos();
      initRealtimeBoard();
      setInterval(() => { if (!editingText && !document.hidden) loadSiteContent(); }, PERF_LITE ? 180000 : 90000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !editingText) loadSiteContent();
      });

      // Player disiapkan langsung, tapi TIDAK autoplay: suara baru keluar
      // setelah pengunjung pencet tombol play (preload="none", jadi hemat data).
      initMusic();
    });
  