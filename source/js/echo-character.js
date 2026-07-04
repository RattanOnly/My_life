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

    var failedBeforeCache = false;
    var pendingLoad = new Promise(function loadRiveScript(resolve, reject) {
      var doc = getDocument();
      var script = null;

      function fail(error) {
        failedBeforeCache = true;
        scriptLoadPromise = null;
        if (script && typeof script.remove === 'function') {
          script.remove();
        }
        reject(error);
      }

      if (!doc || !doc.createElement) {
        fail(new Error('Rive runtime requires a document'));
        return;
      }

      script = doc.createElement('script');
      script.src = RIVE_SCRIPT_SRC;
      script.async = true;
      script.onload = function onload() {
        if (win.rive) {
          resolve(win.rive);
          return;
        }
        fail(new Error('Rive runtime did not expose window.rive'));
      };
      script.onerror = function onerror() {
        fail(new Error('Failed to load Rive runtime'));
      };

      var target = doc.head || doc.body || doc.documentElement;
      if (!target || !target.appendChild) {
        fail(new Error('Rive runtime requires a document target'));
        return;
      }
      try {
        target.appendChild(script);
      } catch (error) {
        fail(error);
      }
    });

    scriptLoadPromise = failedBeforeCache ? null : pendingLoad;
    return pendingLoad;
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
    return {
      mode: byInputName(inputs, 'mode'),
      enter: byInputName(inputs, 'enter'),
      attention: byInputName(inputs, 'attention'),
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
      var destroyed = false;
      var settleReadyOnDestroy = null;

      function fallbackReady() {
        if (destroyed) {
          return false;
        }
        setReady(shell, 'fallback');
        setShellState(shell, fallback, currentState);
        return false;
      }

      function cleanupRive() {
        try {
          if (riveInstance && typeof riveInstance.cleanup === 'function') {
            riveInstance.cleanup();
          }
        } catch (error) {
          if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('Echo character Rive cleanup failed:', error);
          }
        } finally {
          riveInstance = null;
          inputs = {};
        }
      }

      function applyState(state) {
        if (destroyed) {
          return;
        }
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
        if (destroyed) {
          return;
        }
        shell.dataset.echoCharacterEntered = 'true';
        if (!reduced && inputs.enter && typeof inputs.enter.fire === 'function') {
          inputs.enter.fire();
        }
      }

      function destroy() {
        destroyed = true;
        if (settleReadyOnDestroy) {
          settleReadyOnDestroy();
        }
        cleanupRive();
      }

      var ready = Promise.resolve().then(function initialize() {
        if (destroyed) {
          return false;
        }
        if (reduced || !canvas) {
          return fallbackReady();
        }

        return loadRive().then(function onRuntime(runtime) {
          if (destroyed) {
            return false;
          }
          var Rive = runtime && runtime.Rive;
          if (!Rive) {
            throw new Error('Rive runtime missing Rive constructor');
          }

          if (runtime.RuntimeLoader) {
            if (typeof runtime.RuntimeLoader.setWasmUrl === 'function') {
              runtime.RuntimeLoader.setWasmUrl(RIVE_WASM_SRC);
            }
            if (typeof runtime.RuntimeLoader.setWasmFallbackUrl === 'function') {
              runtime.RuntimeLoader.setWasmFallbackUrl(RIVE_FALLBACK_WASM_SRC);
            }
          }

          var layout = runtime.Layout ? new runtime.Layout({
            fit: runtime.Fit && runtime.Fit.Contain,
            alignment: runtime.Alignment && runtime.Alignment.Center
          }) : undefined;
          return new Promise(function createRiveInstance(resolve) {
            var settled = false;
            var settleOnDestroy = null;

            function finish(value) {
              if (settled) {
                return;
              }
              settled = true;
              if (settleReadyOnDestroy === settleOnDestroy) {
                settleReadyOnDestroy = null;
              }
              resolve(value);
            }

            settleOnDestroy = function settleOnDestroy() {
              cleanupRive();
              finish(false);
            };
            settleReadyOnDestroy = settleOnDestroy;

            function completeFallback(error) {
              if (settled) {
                return;
              }
              cleanupRive();
              if (destroyed) {
                finish(false);
                return;
              }
              if (global.console && typeof global.console.warn === 'function') {
                global.console.warn('Echo character Rive fallback:', error);
              }
              finish(fallbackReady());
            }

            function completeLoad() {
              if (settled) {
                return;
              }
              if (destroyed) {
                cleanupRive();
                finish(false);
                return;
              }
              try {
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
                finish(true);
              } catch (error) {
                completeFallback(error);
              }
            }

            function deferCompleteLoad() {
              Promise.resolve().then(completeLoad);
            }

            function deferCompleteFallback(error) {
              Promise.resolve().then(function completeDeferredFallback() {
                completeFallback(error);
              });
            }

            try {
              riveInstance = new Rive({
                src: shell.dataset.echoRiveSrc || shell.getAttribute('data-echo-rive-src') || RIVE_SRC,
                canvas: canvas,
                autoplay: true,
                stateMachines: STATE_MACHINE,
                layout: layout,
                onLoad: deferCompleteLoad,
                onLoadError: deferCompleteFallback
              });
            } catch (error) {
              completeFallback(error);
            }
          });
        }).catch(function onError(error) {
          if (destroyed) {
            return false;
          }
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
