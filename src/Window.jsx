/*global chrome*/
import React from 'react'
import Tab from './Tab'

export default (props) => {
  /*
   * Event Handlers
   */
  // Create a new tab on this window
  const addTab = () => {
    chrome.tabs.create({windowId: props.window.id})
  }

  // Close this window and all its tabs
  const close = () => {
    chrome.windows.remove(props.window.id)
  }

  // See if we should show the window at all
  const hideWindow = props.filterTabs && props.tabs
    .map(tab => !!props.hiddenTabs[tab.id])
    .reduce((agg, hidden) => agg &= hidden, true)

  if(!hideWindow) {
    // Create a Tab component for each tab on this window
    const tabsperrow = props.layout === 'blocks' ? Math.ceil(Math.sqrt(props.tabs.length + 2)) : (props.layout === 'vertical' ? 1 : 15)
    const tabs = props.tabs.map(tab => {
      const isHidden = !!props.hiddenTabs[tab.id] && props.filterTabs
      const isSelected = !!props.selection[tab.id]

      return (<Tab
        window={props.window}
        layout={props.layout}
        tab={tab}
        selected={isSelected}
        hidden={isHidden}
        middleClick={props.tabMiddleClick}
        select={props.select}
        drag={props.drag}
        drop={props.drop}
      //ref={`tab${tab.id}`}
      />)
    })

    //TODO: Refactor into map?
    var children = [];
    for(var j = 0; j < tabs.length; j++){
      if(j % tabsperrow === 0 && j && (j < tabs.length-1 || props.layout === 'blocks')) {
        children.push(<div className="newliner" />)
      }
      children.push(tabs[j]);
    }

    return (
      <div className={`window ${props.layout === 'blocks' && 'block'}`}>
        {children}
        <div className={`icon add ${props.layout !== 'blocks' && 'windowaction'}`} onClick={addTab} />
        <div className={`icon close ${props.layout !== 'blocks' && 'windowaction'}`} onClick={close} />
      </div>
    )
  } else {
    return null
  }
}
