/*global chrome*/
import React, { useEffect, useState, useReducer } from 'react'
import Window from './Window'
import classnames from 'classnames'
import './styles/icon.scss'
import './styles/searchbox.scss'

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


/*
 * Root Component Definition
 */
export default (props) => {
  /*
   * State
   */
  // Cache of all chrome window models
  const [wincache, setCache] = useState([])
  // Collection of displayed chrome window models, fully dependent
  const [windows, setWindows] = useState([])

  // Reducer for converting search terms into a filter regex
  const [term, setTerm] = useReducer((current, term) => term && new RegExp(`.*${term}.*`, 'i'))

  // Reducer to toggle between showing or hiding selected tabs
  const [filterTabs, toggleFilterTabs] = useReducer(filterTabs => !filterTabs, !!localStorage['filter-tabs'])
  // Persist filter option when it changes
  useEffect(() => { localStorage['filter-tabs'] = filterTabs ? 1 : '' }, [filterTabs])

  // Reducer that cycles through UI layout styles; horizontal, vertical, or block
  const [layout, cycleLayout] = useReducer(
    layout => layouts[(layouts.indexOf(layout) + 1) % layouts.length],
    localStorage['layout'] || layouts[0]
  )
  // Persist layout selection when it changes
  useEffect(() => { localStorage['layout'] = layout }, [layout])

  // Calculate displayed window models dependent value
  useEffect(() => {
    // Search term display filter for tabs
    const pickDisplayTabs = (tabs) => (
      tabs
        // Set `selected` on the tabs according to the current search term
        .map(tab => ({
          ...tab,
          selected: term.test(tab.filterkey)
        }))
        // Remove non-selected tabs if filtering is enabled
        .filter(tab => !filterTabs || tab.selected)
        // Sort tabs by their index
        .sort((taba, tabb) => taba.index - tabb.index)
    )

    // Set the windows for display
    setWindows(
      wincache
        .map(window => ({
          ...window,
          // filter tabs if there's a search term
          ...term && { tabs: pickDisplayTabs(window.tabs) }
        }))
        // Only show windows which have any tabs
        .filter(window => window.tabs)
    )
  }, [wincache, term, filterTabs])

  // Hook all events that mutate the wincache and initialize it from chrome
  useEffect(() => {
    // Hook into window events from chrome and update the cache
    chrome.windows.onCreated.addListener(w => setCache(cache => [ ...cache, toWindowModel(w) ]))
    chrome.windows.onRemoved.addListener(rid => setCache(cache => cache.filter(w => w.id !== rid)))


    // Tab was closed (tabId, removeInfo), remove tab from models if !isWindowClosing
    chrome.tabs.onRemoved.addListener((rid, ri) => ri.isWindowClosing || setCache(cache =>
      cache.map(w => ({ ...w,  ...w.id === ri.windowId && { tabs: w.tabs.filter(t => t.id !== rid) } }))
    ))


    // TODO: Hook into tab events from chrome
    const update = (op) => {
      return (...args) => {
        console.log(`tabs.${op} was called`, args)
      }
    }
    chrome.tabs.onCreated.addListener(update('created')) // Tab was created (tab), inject into model collection
    chrome.tabs.onUpdated.addListener(update('updated')) // Tab was updated (tabId, changeInfo, tab), recreate existing model
    chrome.tabs.onMoved.addListener(update('moved')) // Tab index was changed intrawindow (tabId, moveInfo), update tab.index in model
    chrome.tabs.onDetached.addListener(update('detached')) // Tab was detached from window (tabId, detachInfo), remove from model collection
    chrome.tabs.onAttached.addListener(update('attached')) // Tab was attached to a window (tabId, attachInfo), add to model collection
    chrome.tabs.onReplaced.addListener(update('replaced')) // Tab was replaced (aTab, rTab) with a background prerendered or instant tab, replace tab in model


    // Now that events are hooked, kick off async request to
    // enumerate all the existing windows and tabs
    chrome.windows.getAll({ populate: true }, windows => {
      setCache(windows.map(window => toWindowModel(window)))
    })
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
