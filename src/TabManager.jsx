import React, { useEffect, useState, useReducer } from 'react'
import {
  assoc, pick, curry, forEachObjIndexed, forEach, path, view,
  prop, flatten, map, filter, pipe, tap, compose, when,
  lensProp, over, andThen, objOf, not, set
} from 'ramda'

import Window from './Window'
import classnames from 'classnames'
import { tabs, windows } from './chromewrap'

import './styles/icon.scss'
import './styles/searchbox.scss'
import '@fortawesome/fontawesome-free/css/all.css'

// Migrate localStorage values to JSON
if(!localStorage['migrated']) {
  forEachObjIndexed(
    (value, key) => localStorage[key] = JSON.stringify(value),
    localStorage
  )
  localStorage['migrated'] = 'true'
}

// Keycode constants
const KEY_ENTER = 13

// Layout style constants
const layouts = ['horizontal', 'vertical', 'block']

// Convert a chrome Tab object to a model
const toTabModel = tab => ({
  id: tab.id,
  windowId: tab.windowId,
  url: tab.url,
  title: tab.title,
  pinned: tab.pinned,
  incognito: tab.incognito,
  favIconUrl: tab.favIconUrl,
  index: tab.index,
  filterkey: tab.title + tab.url,
  selected: false,
})

// Convert a chrome Window object to model
const toWindowModel = window => ({
  id: window.id,
  // Map tabs to models if they exist (tabs property is optional)
  tabs: window.tabs?.map(tab => toTabModel(tab)) ?? [],
})

// Lens to the tabs object property for a window model
const tabsLens = lensProp('tabs')
// Execute some operation over the tabs lens
const overTabs = over(tabsLens)

const selectedLens = lensProp('selected')
const overSelected = over(selectedLens)

// Given the window cache, returns all selected tabs
const getSelectedTabs = compose(
  flatten,
  map(
    compose(
      filter(view(selectedLens)),
      prop('tabs')
    )
  )
)

// Custom hook that persists a reducer value to localStorage
const usePersistedReducer = (key, reduce, initial) => {
  // Setup the reducer, get initial from localStorage if available
  const [value, setValue] = useReducer(reduce, localStorage.hasOwnProperty(key) ? JSON.parse(localStorage[key]) : initial)

  // Persist value when it changes
  useEffect(() => { localStorage[key] = JSON.stringify(value) }, [key, value])

  return [value, setValue]
}


/*
 * Root Component Definition
 */
export default (props) => {
  /*
   * State
   */
  // Cache of all window and tab models
  const [wincache, setCache] = useState([])
  // Collection of displayed chrome window and tab models, fully dependent
  const [dispwindows, setWindows] = useState([])

  const [searchText, setSearchText] = useState('')
  // Reducer for converting search terms into a filter regex
  const [term, setTerm] = useReducer((current, term) => term && new RegExp(`.*${term}.*`, 'i'))

  // Reducer to toggle between showing or hiding selected tabs
  const [filterTabs, toggleFilterTabs] = usePersistedReducer('filter-tabs', filterTabs => !filterTabs, false)
  // Reducer that cycles through UI layout styles; horizontal, vertical, or block
  const [layout, cycleLayout] = usePersistedReducer(
    'layout',
    layout => layouts[(layouts.indexOf(layout) + 1) % layouts.length],
    layouts[0]
  )

  // Update the search term when the search text changes
  useEffect(() => {
    setTerm(searchText)
  }, [searchText])

  // Calculate the displayed window models dependent value
  useEffect(() => {
    // State of the filtering option
    const filtering = () => filterTabs
    // Whether there is a search term
    const haveTerm = () => !!term

    // Window display filter
    const pickDisplayModels =
      compose(
        // Don't show windows with no selected tabs
        filter(window => window.tabs.length),
        map(overTabs(
          //Only operate on selected when there's a search term
          when(haveTerm,
            compose(
              // When filtering is enabled, hide tabs that are not selected
              when(filtering, filter(t => t.selected)),
              map(tab => assoc('selected', term.test(tab.filterkey), tab))
            )
          )
        ))
      )

    // Update the display model from the cache
    setWindows(pickDisplayModels(wincache))
  }, [wincache, term, filterTabs])

  // Hook all events that mutate the wincache and initialize it from chrome
  useEffect(() => {
    // Enumerate all the existing windows and tabs into the cache
    const syncCache = () =>
      andThen(compose(tap(setCache), map(toWindowModel)))
        (windows.getAll({ populate: true }))

    // Hook into window events from chrome
    windows.onCreated.addListener(syncCache)
    windows.onRemoved.addListener(syncCache)

    // Hook into tab events from chrome
    forEach(
      event => tabs[event].addListener(syncCache),
      ['onCreated', 'onRemoved', 'onUpdated', 'onMoved',
        'onDetached', 'onAttached', 'onReplaced']
    )

    // Now that events are hooked, do the initial cache fill
    syncCache()
  }, [])


  /*
   * Handlers
   */
  // Watches for certain keypresses in the search box
  const searchKeyDown = (e) => {
    // When enter is pressed, execute the add window functionality
    if(e.keyCode === KEY_ENTER) {
      addWindow()
    }
  }

  // Close any tabs that are currently in the selected state
  const closeSelectedTabs = () =>
    compose(tabs.remove, map(prop('id')))(getSelectedTabs(dispwindows))

  // Adds a new browser window
  // If any tabs are selected, they will be moved to the new window
  const addWindow = () =>
      windows.create({ tabs: getSelectedTabs(dispwindows) })

  // Toggle the selected flag on a specified tab
  const toggleSelected = id => setCache(
    map( // for each window
      overTabs(map( // lens into each tab
        // for the tab that matches `id`, invert the `selected` prop
        when(t => t.id === id, overSelected(not))
      ))
    )(wincache)
  )

  // Set the selected flag on a specific tab to a specific state
  const setSelected = (state, id) => setCache(
    map(
      overTabs(map(
        when(t => t.id === id, set(selectedLens, state))
      ))
    )(wincache)
  )

  // Toggle pin mode on all selected tabs
  const pinTabs = () =>
    forEach(
      tab => tabs.update({ pinned: !tab.pinned }, tab.id)
    )(getSelectedTabs(dispwindows))

  // A tab has begun being dragged
  const drag = (e,id) => setSelected(true, id)


  /*
   * INCOMPLETE
   */

  // Logic when a tab is dropped
  const drop = async (id, before) => {
    var tab = this.state.tabsbyid[id]
    var tabs = Object.keys(this.state.selection).map(id => this.state.tabsbyid[id])
    var index = tab.index+(before?0:1)

    for(var i = 0; i < tabs.length; i++){
      (async function(t){
        await tabs.move(t.id, { windowId: tab.windowId, index })
        tabs.update(t.id, { pinned: t.pinned })
      })(tabs[i])
    }
  }


  /*
   * Main Component
   */
  return (
    <div className={`manager ${layout}`}>
      <div className="windows">
        {dispwindows.map(window => (
          <Window
            key={window.id.toString()}
            window={window}
            tabs={window.tabs}
            layout={layout}
            select={toggleSelected}
            drag={drag}
            drop={drop}
          />
        ))}
      </div>
      <footer className="searchbox">
        <div className="content">
          <input type="text" value={searchText}
            onChange={pipe(path(['target', 'value']), tap(setSearchText))}
            onKeyDown={searchKeyDown}
            autoFocus
          />
        </div>

        <div className="commands">
          <div className="icon action new" title="Add Window" onClick={addWindow} />
          <div className={classnames('icon', 'action', 'filter', { enabled: filterTabs })}
            title={`${filterTabs ? 'Do not hide' : 'Hide'} non-matching Tabs`}
            onClick={toggleFilterTabs}
          />
          <div className="icon action pin" title="Pin Tabs" onClick={pinTabs} />
          <div className="icon action trash" title="Delete Tabs" onClick={closeSelectedTabs} />
          <div className="icon action layout" title="Change layout" onClick={cycleLayout} />
        </div>
      </footer>
      <div className="grip"><i className="fas fa-th"/></div>
    </div>
  )
}
