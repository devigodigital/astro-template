// ConsentBanner.js
// Behaviour for ConsentBanner.astro.
// Removes the banner if a choice was already made, otherwise wires up the buttons.

(function () {
    var banner = document.getElementById('devigo-consent-banner');
    if (!banner) return;

    var siteId = banner.getAttribute('data-site-id');
    var consentKey = 'devigo_consent_' + siteId;

    var stored = localStorage.getItem(consentKey);
    if (stored !== null) {
        banner.remove();
        return;
    }

    document.getElementById('devigo-consent-accept')?.addEventListener('click', function () {
        localStorage.setItem(consentKey, 'true');
        banner.remove();
        window.__devigoTrack?.();
    });

    document.getElementById('devigo-consent-decline')?.addEventListener('click', function () {
        localStorage.setItem(consentKey, 'false');
        banner.remove();
    });
})();
