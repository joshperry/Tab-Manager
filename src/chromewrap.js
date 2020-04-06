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

  onCreated: chrome.tabs.onCreated,
  onRemoved: chrome.tabs.onRemoved,
  onUpdated: chrome.tabs.onUpdated,
  onMoved: chrome.tabs.onMoved,
  onDetached: chrome.tabs.onDetached,
  onAttached: chrome.tabs.onAttached,
  onReplaced: chrome.tabs.onReplaced,
}

// Given a window, removes the first tab
const removeHeadTab = pipe(
  window => tabs.query({ windowId: window.id }),
  andThen(
    compose(tab => tabs.remove(tab.id), head)
  )
)

const cwcreate = promisify(chrome.windows.create)

export const windows = {
  getAll: promisify(chrome.windows.getAll),
  getCurrent: promisify(chrome.windows.getCurrent),

  create: async props => {
    // create the new window
    const window = await cwcreate(dissoc('tabs', props))

    // Add support for `tabs` prop to move multiple windows when creating a new window
    if(props.tabs?.length) {
      // Copy tabid and pinned state before move (chrome wipes pin state on move)
      const tabscopy = map(pick(['id', 'pinned']), props.tabs)

      // Move the tabs
      await tabs.move({ windowId: window.id, index: -1 }, map(prop('id'), props.tabs))
      // nuke the "New Tab"
      removeHeadTab(window)

      // Update the pin state on the moved tabs
      forEach(
        when(prop('pinned'), compose(tabs.update({ pinned: true }), prop('id'))),
        tabscopy
      )
    }
  },

  onCreated: chrome.windows.onCreated,
  onRemoved: chrome.windows.onRemoved,
}

export default {
  windows,
  tabs
}
