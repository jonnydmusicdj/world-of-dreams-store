/**
 * World of Dreams — Carousel arrows.
 *
 * Makes the `.wod-arrow-btn` buttons scroll their sibling
 * `.wod-carousel-track` horizontally by 320px (left/right).
 *
 * @package Extendable
 */
(function () {
    'use strict';

    var STEP = 320;

    function directionOf(btn) {
        var label = (btn.getAttribute('aria-label') || '').toLowerCase();
        var text = (btn.textContent || '').trim();
        if (label.indexOf('anterior') !== -1 || label.indexOf('prev') !== -1 ||
            text === '<' || text === '‹' || text === '←') {
            return -1;
        }
        if (label.indexOf('seguinte') !== -1 || label.indexOf('next') !== -1 ||
            text === '>' || text === '›' || text === '→') {
            return 1;
        }
        return 1;
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        var btn = target.closest('.wod-arrow-btn');
        if (!btn) {
            return;
        }

        var box = btn.closest('.wod-showcase-box');
        if (!box) {
            return;
        }

        var track = box.querySelector('.wod-carousel-track');
        if (!track) {
            return;
        }

        event.preventDefault();

        var dir = directionOf(btn);
        track.scrollBy({ left: dir * STEP, behavior: 'smooth' });
    });
})();
