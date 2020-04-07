/*global chrome*/
import { curry, compose, pick, map, when, dissoc, andThen, head, prop, pipe, objOf, forEach } from 'ramda'

const promisify = func => (...args) => new Promise(done => func(...args, done))

// Simple wrapper to make chrome's API more useable with contemporary JS
// and additional functionality.
// Promisify and FP friendlify (iteratee-first, data-last, and curried)

const ctmove = promisify(chrome.tabs.move)
const ctupdate = promisify(chrome.tabs.update)

export const tabs = {
  create: promisify(chrome.tabs.create),
  move: curry((props, tabids) => ctmove(tabids, props)),
  update: curry((props, tabid) => ctupdate(tabid, props)),
  remove: promisify(chrome.tabs.remove),
  getSelected: promisify(chrome.tabs.getSelected),
  query: promisify(chrome.tabs.query),

  // Events
  onCreated: chrome.tabs.onCreated,
  onRemoved: chrome.tabs.onRemoved,
  onUpdated: chrome.tabs.onUpdated,
  onMoved: chrome.tabs.onMoved,
  onDetached: chrome.tabs.onDetached,
  onAttached: chrome.tabs.onAttached,
  onReplaced: chrome.tabs.onReplaced,
}


const cwcreate = promisify(chrome.windows.create)

export const windows = {
  getAll: promisify(chrome.windows.getAll),
  getCurrent: promisify(chrome.windows.getCurrent),

  create: async props => {
    // Add support for `tabs` prop to move multiple windows when creating a new window
    if(props.tabs?.length) {
      // Copy tab id and pinned state before move (chrome wipes pin state on move)
      const [first, ...rest] = map(pick(['id', 'pinned']), props.tabs)

      // create the new window with the first tab
      const window = await cwcreate({ ...dissoc('tabs', props), tabId: first.id })

      // Move the remaining tabs if any
      if(rest.length) {
        await tabs.move({ windowId: window.id, index: -1 }, map(prop('id'), rest))
      }

      // Update the pin state on the moved tabs
      await Promise.all(map(
        when(prop('pinned'), compose(tabs.update({ pinned: true }), prop('id'))),
        [first, ...rest]
      ))

      return window
    } else {
      // create the new window
      return await cwcreate(props)
    }
  },

  // Events
  onCreated: chrome.windows.onCreated,
  onRemoved: chrome.windows.onRemoved,
}

export default {
  windows,
  tabs
}
