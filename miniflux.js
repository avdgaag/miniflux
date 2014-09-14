// Miniflux.js is a hobby project implementation of the Facebook's Flux
// architecture. It provides the basic mechanism for a one-way event system
// where views trigger actions through the dispatcher where they propagate
// through various stores which then update the views.
//
// ## Brief example
//
// Create a dispatcher for the application to handle your events:
//
//     var AppDispatcher = Miniflux.Dispatcher.extend({
//       handleViewAction: function(payload) {
//         this.dispatch({
//           source: 'VIEW',
//           action: payload
//         });
//       }
//     });
//     var dispatcher = new AppDispatcher();
//
// Create a store to track your application state:
//
//     var TodoStore = Miniflux.Store.extend({
//       initialize: function() {
//         this.items = [];
//       },
//
//       onAddTodo: function(payload) {
//         this.items.push(payload.title);
//         // update view somehow
//       }
//     });
//     var todoStore = new TodoStore({ dispatcher: dispatcher });
//
// It is useful to define your action names as "constants" for easy reference
// throughout your application:
//
//     var actions = Miniflux.Enum('ADD_TODO');
//
// Then, in your views, you can dispatch an action:
//
//     document.getElementById('new-item-form').addEventListener('submit, function(e) {
//       e.preventDefault();
//       var title = document.getElementById('item-input').value;
//       dispatcher.handleViewAction({ action: actions.ADD_TODO, title: title });
//     }, false);
//
// The dispatched action will be distributed by the Dispatcher through all
// stores which will in turn update the views.
(function () {
  "use strict";

  // Library version number
  var version = '0.1.0';

  // ## Helper functions
  //
  // ### Inheritence helper function

  // Provide the inheritence mechanism for `Store` and `Dispatcher` to make
  // "subclasses" by setting up the right prototype chain.
  var inherit = function(protoProps) {
    var parent = this;
    var child = function() { return parent.apply(this, arguments); };
    extend(child, parent);
    var Ghost = function() { this.constructor = child; };
    Ghost.prototype = parent.prototype;
    child.prototype = new Ghost();
    extend(child.prototype, protoProps);
    child.__super__ = parent.prototype;
    return child;
  };

  // Standard `extend` function to copy properties from one or more objects
  // into a target object. The first argument is the target object that
  // receives new properties; any other arguments are source objects whose
  // properties will be copied.
  var extend = function(obj) {
    var source, prop;
    for(var i = 1; i <= arguments.length; i++) {
      source = arguments[i];
      for(prop in source) {
        if(source.hasOwnProperty(prop)) {
          obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Take a constant name in screaming snake case (e.g. "MY_ACTION") and
  // transform it into the name of a callback function in camel case (e.g.
  // "onMyAction").
  var actionNameToCallbackName = function(action_name) {
    return 'on' + action_name.toLowerCase().replace(/(^|_)(.)/g, function() {
      return arguments[2].toUpperCase();
    });
  };

  // ## Store

  // Constructor to build a new Store object. The store handles state in the
  // application and registers itself with the given dispatcher to listen to
  // actions in the system. It can then act on those actions as it sees fit --
  // probably by triggering changes in the application view layer.
  //
  // The constructor takes an `options` object that is expected to have a
  // `dispatcher` attribute that it can call `register` on.
  //
  // When a dispatcher is passed in, we immediately register ourselves with it
  // and track our `dispatchId` which other stores can use to indicate they
  // want to wait for operations in this store to finish before running their
  // own callbacks.
  //
  // You can use a standard Dispatcher instance as-is, but it is recommended
  // to subclass it for further customization using `Store.extend`.
  function Store(options) {
    if(!options.dispatcher || !options.dispatcher.register) {
      throw new Error('Store(...): required option `dispatcher` is missing');
    }
    this.dispatchId = options.dispatcher.register(this.handleCallback.bind(this));
    this.initialize.apply(this, arguments);
  }

  extend(Store.prototype, {

    // The default initializer is a no-op function but you can override it in
    // your subclasses. It takes the same arguments as the constructor
    // function.
    initialize: function() {},

    // Optional action source to filter on. If you override this attribute in your
    // subclass you can let your store only respond to actions of a certain source.
    source: null,

    // Callback handler that is registered with the dispatcher. This function handles
    // delegating the incoming dispatched action to appropriately named functions in
    // the store. For example, an incoming action called "CREATE_POST" will call
    // a function "onCreatePost" if it exists.
    handleCallback: function(payload) {
      var source = payload.source;
      var action = payload.action;

      // We assume a callback payload always has a `source` attribute.
      if(!source) {
        throw new Error('Store.handleCallback(...): payload does not have a valid `source` attribute');
      }

      // ...and an `action` that has the actually dispatched payload.
      if(!action) {
        throw new Error('Store.handleCallback(...): payload does not have a valid `action` attribute');
      }

      // Only continue if the source of the incoming action matches our `source` filter.
      if(this.source && this.source !== payload.source) {
        return;
      }

      var callbackName = actionNameToCallbackName(action.action);

      if(this[callbackName]) {
        this[callbackName](action);
      }
    }
  });

  // ## Dispatcher

  // The Dispatcher constructor sets up a new object to distribute events
  // through the system. It ensures all events are run only once, and no new
  // dispatches can be started while another is still running. It even allows
  // listeners to indicate they want to wait for other listeners to complete
  // before they themselves continue.
  //
  // You can use a standard Dispatcher instance as-is, but it is recommended to
  // subclass it for further customization using `Dispatcher.extend`.
  //
  // The Dispatcher is basically the same as the one in Facebook's Flux example.
  function Dispatcher() {
    this.callbacks = [];
    this.isPending = [];
    this.isHandled = [];
    this.pendingPayload = null;
    this.isDispatching = false;
    this.initialize.apply(this, arguments);
  }

  extend(Dispatcher.prototype, {
    // Subclasses can provide a custom initialization funtion. The default is a
    // no-op.
    initialize: function() {
    },

    // ### Public API

    // Register a new callback function to listen for actions. The callback
    // will be called for every event and has to decide for itself whether it
    // wants to react to it. It returns a unique ID that other registered
    // functions could use to identify this listener when using the `waitFor`
    // function.
    register: function(callback) {
      this.callbacks.push(callback);
      return this.callbacks.length - 1;
    },

    // Dispatch a new action throughout the system. This will lock the
    // dispatcher while the action propagates with the given payload.
    // Registered listeners will be invoked with the given payload and can use
    // `waitFor` if they want to wait for other listeners to run before
    // continuing themselves.
    dispatch: function(payload) {
      if(this.isDispatching) {
        throw new Error('Dispatcher.dispatch(...): cannot dispatch in the middle of a dispatch');
      }
      this.startDispatching(payload);
      try {
        this.callbacks.forEach(function(callback, i) {
          if(!this.isPending[i]) {
            this.invokeCallback(i);
          }
        }.bind(this));
      } finally {
        this.stopDispatching(payload);
      }
    },

    // Use `waitFor` inside a listener function to indicate you want to wait
    // for other listener functions to run before you continue. It does not
    // make sense to use this function outside of a dispatching cycle.
    //
    // If two listeners end up waiting for each other an error will be thrown.
    waitFor: function(ids) {
      if(!this.isDispatching) {
        throw new Error('Dispatcher.waitFor(...): must be invoked while dispatching');
      }
      for(var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if(this.isPending[id]) {
          if(this.isHandled[id]) {
            throw new Error('Dispatcher.waitFor(...): Circular dependency detected while waiting for `' + id + '`');
          }
          continue;
        }
        if(!this.callbacks[id]) {
          throw new Error('Dispatcher.waitFor(...): `' + id + '` does not map to a registered callback');
        }
        this.invokeCallback(id);
      }
    },

    // ### Private API

    // Run a callback function, tracking it as running.
    invokeCallback: function(index) {
      this.isPending[index] = true;
      this.callbacks[index](this.pendingPayload);
      this.isHandled[index] = true;
    },

    // Prepare for invoking listeners by resetting our state.
    startDispatching: function(payload) {
      this.callbacks.forEach(function(callback, id) {
        this.isPending[id] = false;
        this.isHandled[id] = false;
      }.bind(this));
      this.pendingPayload = payload;
      this.isDispatching = true;
    },

    // Round up the dispatch process.
    stopDispatching: function() {
      this.pendingPayload = null;
      this.isDispatching = false;
    }
  });

  // ## Enum

  // Helper function to define an enum using an object with mirrored
  // keys and values.
  //
  // For example:
  //
  //     var constants = Enum('FOO')
  //     constants.FOO # => 'FOO'
  //
  // The `Enum` is useful for defining action names as constants in your
  // system.
  var Enum = function() {
    var result = {};
    for(var i = 0; i < arguments.length; i++) {
      var name = arguments[i];
      result[name] = name;
    }
    return result;
  };

  // Add the inheritence ability to the `Store` and `Dispatcher`.
  Store.extend = Dispatcher.extend = inherit;

  // ## Public API

  // We quite naively export a global `Miniflux` object with our `Store`,
  // `Dispatcher` and `Enum` functions as well as our version number.
  window.Miniflux = {
    Store: Store,
    Dispatcher: Dispatcher,
    Enum: Enum,
    version: version
  };
}());
