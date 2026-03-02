// Purple Theme Extension
console.log("Purple Theme Extension loading...");

const EXTENSION_ID = "purple-theme";

if (window.orfview && window.orfview.theme) {
    // 1. Apply changes
    window.orfview.theme.setColors({
        '--bg-sidebar': '#2d1b4e',
        '--bg-activity-bar': '#1a0f2e',
        '--bg-status-bar': '#9b59b6',
        '--accent-color': '#9b59b6',
        '--selection-bg': 'rgba(155, 89, 182, 0.3)'
    });
    alert("Purple Theme Extension Loaded! Enjoy the new colors.");

    // 2. Register cleanup
    if (window.orfview.register) {
        window.orfview.register(EXTENSION_ID, () => {
            console.log("Cleaning up Purple Theme...");
            window.orfview.theme.resetColors();
        });
    }

} else {
    console.error("OrfView API not found!");
    alert("OrfView API not found!");
}
