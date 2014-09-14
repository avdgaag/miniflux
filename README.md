# Miniflux -- a toy implementation of Flux

Miniflux.js is a hobby project implementation of the [Facebook's Flux
architecture][flux]. It provides the basic mechanism for a one-way event system
where views trigger actions through the dispatcher where they propagate through
various stores which then update the views.

You can easily read the [annotated source code][] for all the details.

## Brief example

Create a dispatcher for the application to handle your events:

```js
var AppDispatcher = Miniflux.Dispatcher.extend({
  handleViewAction: function(payload) {
    this.dispatch({
      source: 'VIEW',
      action: payload
    });
  }
});
var dispatcher = new AppDispatcher();
```

Create a store to track your application state:

```js
var TodoStore = Miniflux.Store.extend({
  initialize: function() {
    this.items = [];
  },

  onAddTodo: function(payload) {
    this.items.push(payload.title);
    // update view somehow
  }
});
var todoStore = new TodoStore({ dispatcher: dispatcher });
```

It is useful to define your action names as "constants" for easy reference
throughout your application:

```js
var actions = Miniflux.Enum('ADD_TODO');
```

Then, in your views, you can dispatch an action:

```js
document.getElementById('new-item-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var title = document.getElementById('item-input').value;
  dispatcher.handleViewAction({ action: actions.ADD_TODO, title: title });
}, false);
```

The dispatched action will be distributed by the Dispatcher through all
stores which will in turn update the views.

## Credits

**Author**: [Arjan van der Gaag][]  
**Date**: September 2014  

## LICENSE

Copyright (C) 2012 Arjan van der Gaag

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

[annotated source code]: http://avdgaag.github.io/miniflux
[Arjan van der Gaag]: http://arjanvandergaag.nl
[flux]: http://facebook.github.io/react/docs/flux-overview.html
