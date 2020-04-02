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

// Reducer to cycle through possible layouts
const initialLayout = localStorage['layout'] || layouts[0]
function layoutReducer(layout) {
  // Get next layout value
  const newlayout = layouts[(layouts.indexOf(layout) + 1) % layouts.length]

  // Store new value to localStorage then return it
  localStorage['layout'] = newlayout
  return newlayout
}

// Reducer to toggle between filtering tabs and not
const initialFilterTabs = !!localStorage['filter-tabs']
function filterTabsReducer(filterTabs) {
  // Store the new value to localStorage then return it
  localStorage['filter-tabs'] = !filterTabs ? 1 : ''
  return !filterTabs
}

// Reducer to create a regexp for matching the current search term
function termReducer(current, term) {
  // If there is a search term, create a new case-insensitive regexp
  if(term) {
    return new RegExp(`.*${term}.*`, 'i')
  }
}

// Converts a native chrome Tab object to a POJO model
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

// Converts a native chrome Window object to POJO model
const toWindowModel = window => ({
  id: window.id,
  tabs: window.tabs.map(tab => toTabModel(tab)),
})

export default (props) => {
  /*
   * State
   */

  // Cache of all chrome window models
  const [wincache, setCache] = useState([])
  // Collection of displayed chrome window models
  const [windows, setWindows] = useState([])
  // The UI layout style; horizontal, vertical, or block
  const [layout, cycleLayout] = useReducer(layoutReducer, initialLayout)
  // The current search term
  const [term, setTerm] = useReducer(termReducer)
  // Whether tabs which don't match search criteria should be hidden
  const [filterTabs, toggleFilterTabs] = useReducer(filterTabsReducer, initialFilterTabs)


  /*
   * Effects
   */
  // Tab display filter logic
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
    )

    // Set the windows for display
    setWindows(
      wincache
        // filter tabs if there's a search term
        .map(window => ({
          ...window,
          tabs: term ? pickDisplayTabs(window.tabs) : window.tabs
        }))
        // Only show windows which have any tabs
        .filter(window => window.tabs)
    )
  }, [wincache, term, filterTabs])


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
    }else{
      this.setState({ selection: { ...this.state.selection, [id]: true } })
    }
  }


  /*
   * Init
   */
  // Hook into window events from chrome and update the cache
  chrome.windows.onCreated.addListener(window => setCache([...windows, toWindowModel(window)]))
  chrome.windows.onRemoved.addListener(rid => setCache(windows.filter(window => window.id !== rid)))

  // Hook into tab events from chrome
    /*
  chrome.tabs.onCreated.addListener(update)
  chrome.tabs.onUpdated.addListener(update)
  chrome.tabs.onMoved.addListener(update)
  chrome.tabs.onDetached.addListener(update)
  chrome.tabs.onRemoved.addListener(update)
  chrome.tabs.onReplaced.addListener(update)
  */

  // Kick off async request to enumerate all the existing windows and tabs
  useEffect(() => {
    chrome.windows.getAll({ populate: true }, windows => {
      setCache(windows.map(window => toWindowModel(window)))
    })
  }, [])


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
