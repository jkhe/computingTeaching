/* Shared behaviour for all KS3 Computing explorers.
   Usage in a page:
     Explorer.init({ unlockAfter: 6, onReset: function () { ... } });
     Explorer.track();   // call whenever the pupil changes the control
   - The "Next challenge" card (#ex-next) appears after `unlockAfter` changes.
   - The Reset button (#ex-reset) calls onReset and hides the next challenge.
   No storage, no network calls, no tracking. */
(function () {
  "use strict";

  var state = { count: 0, unlockAfter: 6, onReset: null, unlocked: false };

  function nextCard() { return document.getElementById("ex-next"); }

  function unlock() {
    var card = nextCard();
    if (card && !state.unlocked) {
      state.unlocked = true;
      card.classList.add("show");
    }
  }

  function track() {
    state.count += 1;
    if (state.count >= state.unlockAfter) unlock();
  }

  function reset() {
    state.count = 0;
    state.unlocked = false;
    var card = nextCard();
    if (card) card.classList.remove("show");
    if (typeof state.onReset === "function") state.onReset();
  }

  function init(opts) {
    opts = opts || {};
    if (typeof opts.unlockAfter === "number") state.unlockAfter = opts.unlockAfter;
    state.onReset = opts.onReset || null;
    var btn = document.getElementById("ex-reset");
    if (btn) btn.addEventListener("click", reset);
  }

  window.Explorer = { init: init, track: track, unlock: unlock, reset: reset };
})();
