/*global chrome*/
import React, { useEffect, useState, useReducer } from 'react'
import { assoc, map, filter, pipe, tap, compose, when, lensProp, over } from 'ramda'

import Window from './Window'
import classnames from 'classnames'

import './styles/icon.scss'
import './styles/searchbox.scss'

// Migrate localStorage values to JSON
if(!localStorage['migrated']) {
  Object.keys(localStorage).forEach(key => localStorage[key] = JSON.stringify(localStorage[key]))
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

// Custom hook that persists a reducer value to localStorage
const usePersistedReducer = (key, reduce, initial) => {
  // Setup the reducer, get initial from localStorage if available
  const [value, setValue] = useReducer(reduce, JSON.parse(localStorage[key]) ?? initial)

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
  const [windows, setWindows] = useState([])

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

  // Calculate the displayed window models dependent value
  useEffect(() => {
    // State of the filtering option
    const filtering = () => filterTabs
    // Whether there is a search term
    const haveTerm = () => !!term

    // Window display filter
    const pickDisplayWindows =
      compose(
        // Don't show windows with no selected tabs
        filter(window => window.tabs),
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
    setWindows(pickDisplayWindows(wincache))
  }, [wincache, term, filterTabs])

  // Hook all events that mutate the wincache and initialize it from chrome
  useEffect(() => {
    // Enumerate all the existing windows and tabs into the cache
    const populateCache = () =>
      chrome.windows.getAll({ populate: true }, pipe(map(toWindowModel), tap(setCache)))

    // Hook into window events from chrome
    chrome.windows.onCreated.addListener(populateCache)
    chrome.windows.onRemoved.addListener(populateCache)

    // Hook into tab events from chrome
    chrome.tabs.onCreated.addListener(populateCache) // Tab was created, append the tab to the cache
    chrome.tabs.onRemoved.addListener(populateCache) // Tab was closed
    chrome.tabs.onUpdated.addListener(populateCache) // Tab was updated
    chrome.tabs.onMoved.addListener(populateCache) // Tab index was changed intrawindow
    chrome.tabs.onDetached.addListener(populateCache) // Tab was detached from window
    chrome.tabs.onAttached.addListener(populateCache) // Tab was attached to a window
    chrome.tabs.onReplaced.addListener(populateCache) // Tab was replaced with a background prerendered or instant tab

    // Now that events are hooked, do the initial cache fill
    populateCache()
  }, [])


  /*
   * Handlers
   */
  // Adds a new new browser window
  // If any tabs are selected, they will be moved to the new window
  const addWindow = () => {
    const [first, ...tabs] = windows.flatMap(window => window.tabs.filter(tab => tab.selected))

    if(first) {
      // Peel the first selected tab off into a new window
      chrome.windows.create({ tabId: first.id }, newwin => {
        // Tabs lose their pinned value after being moved
        chrome.tabs.update(first.id, { pinned: first.pinned })

        // Move the other selected tabs to the new window
        // and refresh their pinned value
        tabs.forEach(tab => {
          chrome.tabs.move(tab.id, { windowId: newwin.id, index: 1 }, () => {
            chrome.tabs.update(tab.id, { pinned: tab.pinned })
          })
        })
      })
    } else {
      chrome.windows.create({})
    }
  }

  // Watches for certain keypresses in the search box
  const searchKeyDown = (e) => {
    // When enter is pressed, execute the add window functionality
    if(e.keyCode === KEY_ENTER) {
      addWindow()
    }
  }


  /*
   * INCOMPLETE
   */
  const deleteTabs = () => {
    const tabs = Object.keys(this.state.selection).map(id => this.state.tabsbyid[id])
    if(tabs.length){
      for(let i = 0; i < tabs.length; i++) {
        chrome.tabs.remove(tabs[i].id)
      }
    } else {
      chrome.windows.getCurrent(function(w) {
        chrome.tabs.getSelected(w.id, function(t) {
          chrome.tabs.remove(t.id)
        })
      })
    }
  }

  const pinTabs = () => {
    var tabs = Object.keys(this.state.selection).map(id => this.state.tabsbyid[id]).sort((a,b) => a.index-b.index)
    if(tabs.length ) {
      if(tabs[0].pinned) {
        tabs.reverse()
      }

      for(var i = 0; i < tabs.length; i++) {
        chrome.tabs.update(tabs[i].id, { pinned: !tabs[0].pinned })
      }
    } else {
      chrome.windows.getCurrent(function(w) {
        chrome.tabs.getSelected(w.id,function(t) {
          chrome.tabs.update(t.id, { pinned: !t.pinned })
        })
      })
    }
  }

  // Logic when a tab is dropped
  const drop = (id, before) => {
    var tab = this.state.tabsbyid[id]
    var tabs = Object.keys(this.state.selection).map(id => this.state.tabsbyid[id])
    var index = tab.index+(before?0:1)

    for(var i = 0; i < tabs.length; i++){
      (function(t){
        chrome.tabs.move(t.id, { windowId: tab.windowId, index }, function() {
          chrome.tabs.update(t.id, { pinned: t.pinned })
        })
      })(tabs[i])
    }
  }

  // A tab has begun being dragged
  const drag = (e,id) => {
    if(!this.state.selection[id]) {
      this.setState({ selection: { [id]: true } })
    }
  }

  const deleteTab = (tabId) => {
    chrome.tabs.remove(tabId)
  }

  const select = (id) => {
    if(this.state.selection[id]) {
      this.setState({ selection: { ...this.state.selection, [id]: false } })
    } else {
      this.setState({ selection: { ...this.state.selection, [id]: true } })
    }
  }


  /*
   * Main Component
   */
  return (
    <div className={`manager ${layout}`}>
      {windows.map(window => (
        <Window
          key={window.id.toString()}
          window={window}
          tabs={window.tabs}
          layout={layout}
          tabMiddleClick={deleteTab}
          select={select}
          drag={drag}
          drop={drop}
        />
      ))}

      <footer className="searchbox">
        <div className="content">
          <input type="text" onChange={e => setTerm(e.target.value)} onKeyDown={searchKeyDown} autofocus="autofocus" />
        </div>

        <div className="commands">
          <div className="icon action new" title="Add Window" onClick={addWindow} />
          <div className={classnames('icon', 'action', 'filter', { enabled: filterTabs })}
            title={`${filterTabs ? 'Do not hide' : 'Hide'} non-matching Tabs`} onClick={toggleFilterTabs} />
          <div className="icon action pin" title="Pin Tabs" onClick={pinTabs} />
          <div className="icon action trash" title="Delete Tabs" onClick={deleteTabs} />
          <div className="icon action layout" title="Change layout" onClick={cycleLayout} />
        </div>
      </footer>
    </div>
  )
}
