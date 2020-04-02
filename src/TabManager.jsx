/*global chrome*/
import React, { createRef } from 'react'
import Window from './Window'

export default class TabManager extends React.Component {
	state = {
		layout: localStorage['layout'] || 'horizontal',
		windows: [],
		selection: {},
		hiddenTabs: {},
		tabsbyid: {},
		windowsbyid: {},
		filterTabs: !!localStorage['filter-tabs']
	}

	constructor(props) {
		super(props)
		this.update()

    this.searchbox = createRef()
	}

  search = (e) => {
    let hiddenCount = this.state.hiddenCount || 0
    const searchLen = (e.target.value || '').length
    if(!searchLen){
      this.setState({ selection: {} })
      this.setState({ hiddenTabs: {} })
      hiddenCount = 0
    } else {
      let idList
      const lastSearchLen = this.state.searchLen
      if(!lastSearchLen){
        idList = this.state.tabsbyid;
      } else if(lastSearchLen > searchLen) {
        idList = this.state.hiddenTabs
      } else if(lastSearchLen < searchLen) {
        idList = this.state.selection
      } else {
        return
      }

      for(let id in idList) {
        const tab = this.state.tabsbyid[id]
        if((tab.title + tab.url).toLowerCase().indexOf(e.target.value.toLowerCase()) >= 0) {
          hiddenCount -= (this.state.hiddenTabs[id] || 0)
          this.setState({ selection: { ...this.state.selection, [id]: true } })
          this.setState({ hiddenTabs: { ...this.state.hiddenTabs, [id]: false } })
        } else {
          hiddenCount += 1 - (this.state.hiddenTabs[id] || 0)
          this.setState({ selection: { ...this.state.selection, [id]: false } })
          this.setState({ hiddenTabs: { ...this.state.hiddenTabs, [id]: true } })
        }
      }
    }

    this.setState({ hiddenCount })
    this.setState({ searchLen })
    this.forceUpdate()
  }

  render() {
    return (
      <div>
        {this.state.windows.map(window => (
          <Window
            window={window}
            tabs={window.tabs}
            layout={this.state.layout}
            selection={this.state.selection}
            hiddenTabs={this.state.hiddenTabs}
            filterTabs={this.state.filterTabs}
            tabMiddleClick={this.deleteTab}
            select={this.select}
            drag={this.drag}
            drop={this.drop}
          //ref={`window${window.id}`}
          />
        ))}
        <div className="window searchbox">
          <input type="text" onChange={this.search} onKeyDown={this.checkEnter} ref={this.searchbox} />
          <div className={`icon windowaction ${this.state.layout}`} title="Change layout" onClick={this.changlayout} />
          <div className="icon windowaction trash" title="Delete Tabs" onClick={this.deleteTabs} />
          <div className="icon windowaction pin" title="Pin Tabs" onClick={this.pinTabs} />
          <div className={`icon windowaction filter${this.state.filterTabs? ' enabled' : ''}`}
            title={`${this.state.filterTabs ? 'Do not hide' : 'Hide'} non-matching Tabs`} onClick={this.toggleFilterMismatchedTabs} />
          <div className="icon windowaction new" title="Add Window" onClick={this.addWindow} />
        </div>
        <div clasName="window placeholder" />
      </div>
    )
  }

  componentDidMount() {
    this.searchbox.current.focus()
    this.searchbox.current.select()

    chrome.windows.onCreated.addListener(() => this.update())
    chrome.windows.onRemoved.addListener(() => this.update())
    chrome.tabs.onCreated.addListener(() => this.update())
    chrome.tabs.onUpdated.addListener(() => this.update())
    chrome.tabs.onMoved.addListener(() => this.update())
    chrome.tabs.onDetached.addListener(() => this.update())
    chrome.tabs.onRemoved.addListener(() => this.update())
    chrome.tabs.onReplaced.addListener(() => this.update())
  }

  update() {
    chrome.windows.getAll({populate:true}, (windows) => {
      this.setState({ windows })
      this.setState({ windowsbyid: {} })
      this.setState({ tabsbyid: {} })

      let tabCount = 0
      for(let i = 0; i < windows.length; i++) {
        const window = windows[i]
        this.setState({ windowsbyid: { ...this.state.windowsbyid, [window.id]: window } })

        for(let j = 0; j < window.tabs.length; j++) {
          const tab = window.tabs[j]
          this.setState({ tabsbyid: { ...this.state.tabsbyid, [tab.id]: tab } })
          tabCount++
        }
      }

      for(let id in this.state.selection) {
        if(!this.state.tabsbyid[id]) {
          delete this.state.selection[id]
        }
      }

      this.setState({ tabCount })
      this.setState({ searchLen: 0 })
      this.forceUpdate()
    })
  }

  deleteTabs() {
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

  deleteTab(tabId) {
    chrome.tabs.remove(tabId)
  }

  addWindow() {
    const tabs = Object.keys(this.state.selection).map(id => this.state.tabsbyid[id])
    const first = tabs.shift()

    if(first) {
      chrome.windows.create({tabId:first.id},function(w) {
        chrome.tabs.update(first.id,{pinned:first.pinned})
        for(let i = 0; i < tabs.length; i++) {
          (function(tab) {
            chrome.tabs.move(tab.id, { windowId: w.id,index: 1 }, function() {
              chrome.tabs.update(tab.id, { pinned: tab.pinned })
            })
          })(tabs[i])
        }
      })
    } else {
      chrome.windows.create({})
    }
  }

  pinTabs() {
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

  checkEnter(e) {
    if(e.keyCode === 13) {
      this.addWindow()
    }
  }

  changelayout() {
    let layout = 'blocks'
    if(this.state.layout === 'blocks') {
      layout = 'horizontal'
    } else if(this.state.layout === 'horizontal') {
      layout = 'vertical'
    }

    localStorage['layout'] = layout
    this.setState({ layout })
    this.forceUpdate()
  }

  select(id) {
    if(this.state.selection[id]) {
      this.setState({ selection: { ...this.state.selection, [id]: false } })
    }else{
      this.setState({ selection: { ...this.state.selection, [id]: true } })
    }

    this.forceUpdate()
  }

  drag(e,id) {
    if(!this.state.selection[id]) {
      this.setState({ selection: { [id]: true } })
    }

    this.forceUpdate()
  }

  drop(id,before) {
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

  toggleFilterMismatchedTabs() {
    this.setState({ filterTabs: !this.state.filterTabs })
    localStorage['filter-tabs'] = this.state.filterTabs ? 1 : ''

    this.forceUpdate()
  }
}
