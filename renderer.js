window.vapi.onVideoLoaded(path => {

    console.log(`The file path is - ${path}`);
    // Get the content of the <video> tag
    const parent = document.querySelector('.js-player');

    // Remove all the content inside the video tag - the <source> will disapear
    parent.innerHTML = '';

    // Create back the source tag with the new path
    const videoPlayer = document.createElement('source');
    videoPlayer.src = 'file://' + path;

    // Insert the source tag inside the video tag
    parent.appendChild(videoPlayer);

    // Reload the video tag
    parent.load();
});