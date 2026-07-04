(function attachEchoCharacter(global) {
  'use strict';

  var STATE_MACHINE = 'EchoBoyState';
  var RIVE_SRC = '/echo/assets/echo-boy.riv';
  var RIVE_SCRIPT_SRC = '/vendor/rive/rive.js';
  var RIVE_WASM_SRC = '/vendor/rive/rive.wasm';
  var RIVE_FALLBACK_WASM_SRC = '/vendor/rive/rive_fallback.wasm';
  var STATE_MODE = {
    idle: 0,
    listening: 1,
    thinking: 2,
    reply_ready: 3,
    disabled: 4,
    error: 0
  };
  var scriptLoadPromise = null;

  function noop() {}

  function getWindow() {
    if (typeof window !== 'undefined') {
      return window;
    }
    return global;
  }

  function getDocument() {
    var win = getWindow();
    return win.document || global.document || null;
  }

  function prefersReducedMotion() {
    var matcher = global.matchMedia || (getWindow() && getWindow().matchMedia);
    return Boolean(matcher && matcher('(prefers-reduced-motion: reduce)').matches);
  }

  function defaultLoadRive() {
    var win = getWindow();
    if (win.rive) {
      return Promise.resolve(win.rive);
    }

    if (scriptLoadPromise) {
      return scriptLoadPromise;
    }

    scriptLoadPromise = new Promise(function loadRiveScript(resolve, reject) {
      var doc = getDocument();
      if (!doc || !doc.createElement) {
        reject(new Error('Rive runtime requires a document'));
        return;
      }

      var script = doc.createElement('script');
      script.src = RIVE_SCRIPT_SRC;
      script.async = true;
      script.onload = function onload() {
        if (win.rive) {
          resolve(win.rive);
          return;
        }
        reject(new Error('Rive runtime did not expose window.rive'));
      };
      script.onerror = function onerror() {
        reject(new Error('Failed to load Rive runtime'));
      };

      var target = doc.head || doc.body || doc.documentElement;
      if (!target || !target.appendChild) {
        reject(new Error('Rive runtime requires a document target'));
        return;
      }
      target.appendChild(script);
    });

    return scriptLoadPromise;
  }

  function createNoopAdapter() {
    return {
      ready: Promise.resolve(false),
      playEntrance: noop,
      setState: noop,
      destroy: noop
    };
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

  function byInputName(inputs, name) {
    for (var index = 0; index < inputs.length; index += 1) {
      if (inputs[index] && inputs[index].name === name) {
        return inputs[index];
      }
    }
    return null;
  }

  function createInputSet(inputs) {
    var triggers = inputs.filter(function isTrigger(input) {
      return input && typeof input.fire === 'function';
    });

    return {
      mode: byInputName(inputs, 'mode') || inputs[0] || null,
      enter: byInputName(inputs, 'enter') || triggers[0] || null,
      attention: byInputName(inputs, 'attention') || triggers[1] || null,
      reducedMotion: byInputName(inputs, 'reducedMotion') || null
    };
  }

  function createFactory(deps) {
    var options = deps || {};
    var loadRive = options.loadRive || options.importRive || defaultLoadRive;

    function create(root) {
      var shell = root && root.querySelector ? root.querySelector('[data-echo-character]') : null;
      if (!shell) {
        return createNoopAdapter();
      }

      var canvas = shell.querySelector ? shell.querySelector('[data-echo-rive-canvas]') : null;
      var fallback = shell.querySelector ? shell.querySelector('[data-echo-character-fallback]') : null;
      var reduced = prefersReducedMotion();
      var riveInstance = null;
      var inputs = {};
      var currentState = 'idle';

      function fallbackReady() {
        setReady(shell, 'fallback');
        setShellState(shell, fallback, currentState);
        return false;
      }

      function applyState(state) {
        var nextState = Object.prototype.hasOwnProperty.call(STATE_MODE, state) ? state : 'idle';
        currentState = nextState;
        setShellState(shell, fallback, nextState);

        if (inputs.mode) {
          inputs.mode.value = STATE_MODE[nextState];
        }
        if (nextState === 'listening' && inputs.attention && typeof inputs.attention.fire === 'function') {
          inputs.attention.fire();
        }
      }

      function playEntrance() {
        shell.dataset.echoCharacterEntered = 'true';
        if (!reduced && inputs.enter && typeof inputs.enter.fire === 'function') {
          inputs.enter.fire();
        }
      }

      function destroy() {
        if (riveInstance && typeof riveInstance.cleanup === 'function') {
          riveInstance.cleanup();
        }
        riveInstance = null;
      }

      var ready = Promise.resolve().then(function initialize() {
        if (reduced || !canvas) {
          return fallbackReady();
        }

        return loadRive().then(function onRuntime(runtime) {
          var Rive = runtime && runtime.Rive;
          if (!Rive) {
            throw new Error('Rive runtime missing Rive constructor');
          }

          if (runtime.RuntimeLoader) {
            if (typeof runtime.RuntimeLoader.setWasmUrl === 'function') {
              runtime.RuntimeLoader.setWasmUrl(RIVE_WASM_SRC);
            }
            if (typeof runtime.RuntimeLoader.setFallbackUrl === 'function') {
              runtime.RuntimeLoader.setFallbackUrl(RIVE_FALLBACK_WASM_SRC);
            }
          }

          var layout = runtime.Layout ? new runtime.Layout({
            fit: runtime.Fit && runtime.Fit.Contain,
            alignment: runtime.Alignment && runtime.Alignment.Center
          }) : undefined;
          riveInstance = new Rive({
            src: shell.dataset.echoRiveSrc || shell.getAttribute('data-echo-rive-src') || RIVE_SRC,
            canvas: canvas,
            autoplay: true,
            stateMachines: STATE_MACHINE,
            layout: layout
          });

          inputs = createInputSet(
            typeof riveInstance.stateMachineInputs === 'function'
              ? riveInstance.stateMachineInputs(STATE_MACHINE) || []
              : []
          );
          if (inputs.reducedMotion) {
            inputs.reducedMotion.value = false;
          }
          if (typeof riveInstance.resizeDrawingSurfaceToCanvas === 'function') {
            riveInstance.resizeDrawingSurfaceToCanvas();
          }
          applyState(currentState);
          setReady(shell, 'rive');
          return true;
        }).catch(function onError(error) {
          if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('Echo character Rive fallback:', error);
          }
          return fallbackReady();
        });
      });

      return {
        ready: ready,
        playEntrance: playEntrance,
        setState: applyState,
        destroy: destroy
      };
    }

    return {
      create: create,
      loadRive: loadRive
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
