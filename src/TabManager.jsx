/*global chrome*/
import React, { useEffect, useState, useReducer } from 'react'
import Window from './Window'
import classnames from 'classnames'

const KEY_ENTER = 13

// Reducer to cycle through possible layout values
const initialLayout = localStorage['layout'] || 'horizontal'
function layoutReducer(layout) {
  let newlayout = 'blocks'
  if(layout === 'blocks') {
    return 'horizontal'
  } else if(layout === 'horizontal') {
    return 'vertical'
  }

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
function termReducer(term) {
  // If there is a search term, create a new case-insensitive regexp
  if(term) {
    return new RegExp(`.*${term}.*`, 'i')
  }
}

// Converts a native chrome Tab object to a POJO model
const toTabModel = tab => ({
  id: tab.id,
  windowId: tab.windowId,
  pinned: tab.pinned,
  incognito: tab.incognito,
  url: tab.url,
  favIconUrl: tab.favIconUrl,
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
  // The UI layout style; horizontal, vertical, or blocks
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
          selected: term.test(tab.title + tab.url)
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
    <div>
      {windows.map(window => (
        <Window
          key={window.id.toString()}
          window={window}
          tabs={window.tabs}
          layout={layout}
        // selection={{}}
        // hiddenTabs={{}}
          tabMiddleClick={deleteTab}
          select={select}
          drag={drag}
          drop={drop}
        />
      ))}
      <div className="window searchbox">
        <input type="text" onChange={e => setTerm(e.target.value)} onKeyDown={searchKeyDown} autofocus="autofocus" />
        <div className={`icon windowaction ${layout}`} title="Change layout" onClick={cycleLayout} />
        <div className="icon windowaction trash" title="Delete Tabs" onClick={deleteTabs} />
        <div className="icon windowaction pin" title="Pin Tabs" onClick={pinTabs} />
        <div className={classnames('icon', 'windowaction', 'filter', { enabled: filterTabs })}
          title={`${filterTabs ? 'Do not hide' : 'Hide'} non-matching Tabs`} onClick={toggleFilterTabs} />
        <div className="icon windowaction new" title="Add Window" onClick={addWindow} />
      </div>
      <div clasName="window placeholder" />
    </div>
  )
}
