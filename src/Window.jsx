/*global chrome*/
import React from 'react'
import Tab from './Tab'
import classnames from 'classnames'

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

  const isBlockLayout = props.layout === 'blocks'

  // Return the Window component
  return (
    <div className={classnames('window', { block: isBlockLayout })}>
      <div clasName="tabs">
      {
        // Create a Tab component for each tab on this window
        props.tabs.map(tab => (
          <Tab
            key={tab.id.toString()}
            layout={props.layout}
            tab={tab}
            middleClick={props.tabMiddleClick}
            select={props.select}
            drag={props.drag}
            drop={props.drop}
          />
        ))
      }
      </div>
      <div className="commands">
        <div className={classnames('icon', 'add', { windowaction: !isBlockLayout })} onClick={addTab} />
        <div className={classnames('icon', 'close', { windowaction: !isBlockLayout })} onClick={close} />
      </div>
    </div>
  )
}
