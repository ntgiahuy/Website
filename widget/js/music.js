if (sharedBy === 'www.giahuy.net') {
    const wrapper = document.querySelector(".music-box"),
        musicImg = wrapper.querySelector(".img-area img"),
        musicName = wrapper.querySelector(".song-details .name"),
        musicArtist = wrapper.querySelector(".song-details .artist"),
        playPauseBtn = wrapper.querySelector(".play-pause"),
        prevBtn = wrapper.querySelector("#prev"),
        nextBtn = wrapper.querySelector("#next"),
        mainAudio = wrapper.querySelector("#main-audio"),
        progressArea = wrapper.querySelector(".progress-area"),
        progressBar = progressArea.querySelector(".progress-bar"),
        musicList = wrapper.querySelector(".music-list"),
        moreMusicBtn = wrapper.querySelector("#more-music"),
        closemoreMusic = musicList.querySelector("#close"),
        volumeslider = wrapper.querySelector(".volume_slider"),
        maxvolum = wrapper.querySelector("#max-volume"),
        minvolum = wrapper.querySelector("#min-volume");
    
    let musicIndex = Math.floor((Math.random() * giahuyMusic.length) + 1);
    let isMusicPaused = true;
    let curr_track = mainAudio;

    window.addEventListener("load", () => {
        loadMusic(musicIndex);
        playingSong();
    });

    function loadMusic(indexNumb) {
        musicName.innerText = giahuyMusic[indexNumb - 1].name;
        musicArtist.innerText = giahuyMusic[indexNumb - 1].artist;
        musicImg.alt = giahuyMusic[indexNumb - 1].artist;
        musicImg.title = giahuyMusic[indexNumb - 1].artist;
        musicImg.src = giahuyMusic[indexNumb - 1].img;
        mainAudio.src = giahuyMusic[indexNumb - 1].src;
    }

    function playMusic() {
        wrapper.classList.add("paused");
        playPauseBtn.querySelector("i").classList.remove("music-play");
        playPauseBtn.querySelector("i").classList.add("music-pause");
        mainAudio.play();
    }

    function pauseMusic() {
        wrapper.classList.remove("paused");
        playPauseBtn.querySelector("i").classList.remove("music-pause");
        playPauseBtn.querySelector("i").classList.add("music-play");
        mainAudio.pause();
    }

    function prevMusic() {
        musicIndex--;
        musicIndex < 1 ? musicIndex = giahuyMusic.length : musicIndex = musicIndex;
        loadMusic(musicIndex);
        playMusic();
        playingSong();
    }

    function nextMusic() {
        musicIndex++;
        musicIndex > giahuyMusic.length ? musicIndex = 1 : musicIndex = musicIndex;
        loadMusic(musicIndex);
        playMusic();
        playingSong();
    }

    playPauseBtn.addEventListener("click", () => {
        const isMusicPlay = wrapper.classList.contains("paused");
        isMusicPlay ? pauseMusic() : playMusic();
        playingSong();
    });

    prevBtn.addEventListener("click", () => {
        prevMusic();
    });

    nextBtn.addEventListener("click", () => {
        nextMusic();
    });

    mainAudio.addEventListener("timeupdate", (e) => {
        const currentTime = e.target.currentTime;
        const duration = e.target.duration;
        let progressWidth = (currentTime / duration) * 100;
        progressBar.style.width = `${progressWidth}%`;
        let musicCurrentTime = wrapper.querySelector(".current-time"),
            musicDuartion = wrapper.querySelector(".max-duration");
        mainAudio.addEventListener("loadeddata", () => {
            let mainAdDuration = mainAudio.duration;
            let totalMin = Math.floor(mainAdDuration / 60);
            let totalSec = Math.floor(mainAdDuration % 60);
            if (totalSec < 10) {
                totalSec = `0${totalSec}`;
            }
            musicDuartion.innerText = `${totalMin}:${totalSec}`;
        });
        let currentMin = Math.floor(currentTime / 60);
        let currentSec = Math.floor(currentTime % 60);
        if (currentSec < 10) {
            currentSec = `0${currentSec}`;
        }
        musicCurrentTime.innerText = `${currentMin}:${currentSec}`;
    });

    progressArea.addEventListener("click", (e) => {
        let progressWidth = progressArea.clientWidth;
        let clickedOffsetX = e.offsetX;
        let songDuration = mainAudio.duration;
        mainAudio.currentTime = (clickedOffsetX / progressWidth) * songDuration;
        playMusic();
        playingSong();
    });

    const repeatBtn = wrapper.querySelector("#repeat-plist span");
    wrapper.querySelector("#repeat-plist").addEventListener("click", () => {
        let getText = repeatBtn.innerText;
        switch (getText) {
            case "repeat":
                repeatBtn.innerText = "repeat_one";
                wrapper.querySelector("#repeat-plist").classList.toggle("music-repeat");
                wrapper.querySelector("#repeat-plist").classList.toggle("music-repeatone");
                wrapper.querySelector("#repeat-plist").setAttribute("title", "Song looped");
                break;
            case "repeat_one":
                repeatBtn.innerText = "shuffle";
                wrapper.querySelector("#repeat-plist").classList.toggle("music-repeatone");
                wrapper.querySelector("#repeat-plist").classList.toggle("music-shuffle");
                wrapper.querySelector("#repeat-plist").setAttribute("title", "Playback shuffled");
                break;
            case "shuffle":
                repeatBtn.innerText = "repeat";
                wrapper.querySelector("#repeat-plist").classList.toggle("music-shuffle");
                wrapper.querySelector("#repeat-plist").classList.toggle("music-repeat");
                wrapper.querySelector("#repeat-plist").setAttribute("title", "Playlist looped");
                break;
        }
    });

    mainAudio.addEventListener("ended", () => {
        let getText = repeatBtn.innerText;
        switch (getText) {
            case "repeat":
                nextMusic();
                break;
            case "repeat_one":
                mainAudio.currentTime = 0;
                loadMusic(musicIndex);
                playMusic();
                break;
            case "shuffle":
                let randIndex = Math.floor((Math.random() * giahuyMusic.length) + 1);
                do {
                    randIndex = Math.floor((Math.random() * giahuyMusic.length) + 1);
                } while (musicIndex == randIndex);
                musicIndex = randIndex;
                loadMusic(musicIndex);
                playMusic();
                playingSong();
                break;
        }
    });

    moreMusicBtn.addEventListener("click", () => {
        musicList.classList.toggle("show");
    });

    closemoreMusic.addEventListener("click", () => {
        moreMusicBtn.click();
    });

    const ulTag = wrapper.querySelector("ul");
    for (let i = 0; i < giahuyMusic.length; i++) {
        let liTag = `<li li-index="${i + 1}">
                    <div class="row">
                      <span>${giahuyMusic[i].name}</span>
                      <p>${giahuyMusic[i].artist}</p>
                    </div>
                    <span id="${giahuyMusic[i].id}" class="audio-duration">3:40</span>
                    <audio class="${giahuyMusic[i].id}" src="${giahuyMusic[i].src}"></audio>
                  </li>`;
        ulTag.insertAdjacentHTML("beforeend", liTag);
        let liAudioDuartionTag = ulTag.querySelector(`#${giahuyMusic[i].id}`);
        let liAudioTag = ulTag.querySelector(`.${giahuyMusic[i].id}`);
        liAudioTag.addEventListener("loadeddata", () => {
            let duration = liAudioTag.duration;
            let totalMin = Math.floor(duration / 60);
            let totalSec = Math.floor(duration % 60);
            if (totalSec < 10) {
                totalSec = `0${totalSec}`;
            };
            liAudioDuartionTag.innerText = `${totalMin}:${totalSec}`;
            liAudioDuartionTag.setAttribute("t-duration", `${totalMin}:${totalSec}`);
        });
    }

    function playingSong() {
        const allLiTag = ulTag.querySelectorAll("li");

        for (let j = 0; j < allLiTag.length; j++) {
            let audioTag = allLiTag[j].querySelector(".audio-duration");

            if (allLiTag[j].classList.contains("playing")) {
                allLiTag[j].classList.remove("playing");
                let adDuration = audioTag.getAttribute("t-duration");
                audioTag.innerText = adDuration;
            }
            if (allLiTag[j].getAttribute("li-index") == musicIndex) {
                allLiTag[j].classList.add("playing");
                audioTag.innerText = "Playing";
            }
            allLiTag[j].setAttribute("onclick", "clicked(this)");
        }
    }

    function clicked(element) {
        let getLiIndex = element.getAttribute("li-index");
        musicIndex = getLiIndex;
        loadMusic(musicIndex);
        playMusic();
        playingSong();
    }

    function setVolume() {
        curr_track.volume = volumeslider.value / 100;
    }

    maxvolum.addEventListener("click", () => {
        curr_track.volume = 1;
        volumeslider.value = 100
    });
minvolum.addEventListener(“click”, () => {
        curr_track.volume = 0.01;
        volumeslider.value = 0
    });
} else {
window.location.href = ‘https://www.giahuy.net/p/credit.html’;
}
