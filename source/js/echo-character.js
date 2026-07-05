(function attachEchoCharacter(global) {
  'use strict';

  var VALID_STATES = {
    idle: true,
    listening: true,
    thinking: true,
    reply_ready: true,
    disabled: true,
    error: true
  };

  function noop() {}

  function getWindow() {
    if (typeof window !== 'undefined') {
      return window;
    }
    return global;
  }

  function prefersReducedMotion() {
    var matcher = global.matchMedia || (getWindow() && getWindow().matchMedia);
    return Boolean(matcher && matcher('(prefers-reduced-motion: reduce)').matches);
  }

  function setShellState(shell, fallback, state) {
    if (shell) {
      shell.dataset.echoCharacterState = state;
    }
    if (fallback) {
      fallback.dataset.echoCharacterState = state;
    }
  }

  function setReady(shell, value) {
    if (shell) {
      shell.dataset.echoCharacterReady = value;
    }
  }

  function createNoopAdapter() {
    return {
      ready: Promise.resolve(false),
      playEntrance: noop,
      setState: noop,
      destroy: noop
    };
  }

  function createFactory(deps) {
    var options = deps || {};
    var motionPreference = options.prefersReducedMotion || prefersReducedMotion;

    function create(root) {
      var shell = root && root.querySelector ? root.querySelector('[data-echo-character]') : null;
      if (!shell) {
        return createNoopAdapter();
      }

      var fallback = shell.querySelector ? shell.querySelector('[data-echo-character-fallback]') : null;
      var reduced = motionPreference();
      var destroyed = false;
      var currentState = 'idle';

      setReady(shell, 'svg');
      setShellState(shell, fallback, currentState);

      function applyState(state) {
        if (destroyed) {
          return;
        }
        var nextState = Object.prototype.hasOwnProperty.call(VALID_STATES, state) ? state : 'idle';
        currentState = nextState;
        setShellState(shell, fallback, nextState);
      }

      function playEntrance() {
        if (destroyed || reduced) {
          return;
        }
        shell.dataset.echoCharacterEntered = 'true';
      }

      function destroy() {
        destroyed = true;
      }

      return {
        ready: Promise.resolve(true),
        playEntrance: playEntrance,
        setState: applyState,
        destroy: destroy
      };
    }

    return {
      create: create
    };
  }

  var EchoCharacter = {
    create: function create(root) {
      return createFactory().create(root);
    },
    createWithDeps: createFactory
  };

  global.EchoCharacter = EchoCharacter;
  if (typeof window !== 'undefined') {
    window.EchoCharacter = EchoCharacter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
