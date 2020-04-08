import React from 'react'

import { windows, tabs } from './chromewrap'
import Tab from './Tab'

import './styles/window.scss'

export default (props) => {
  /*
   * Event Handlers
   */
  // Create a new tab on this window
  const addTab = () => {
    tabs.create({windowId: props.window.id})
  }

  // Close this window and all its tabs
  const close = () => {
    windows.remove(props.window.id)
  }

  // Return the Window component
  return (
    <section className="window">
      <header>
        <span className="content">
          <i className="fas fa-layer-group"/> Some Window Name
        </span>

        <div className="commands">
          <div className="icon action add" onClick={addTab} />
          <div className="icon action close" onClick={close} />
        </div>
      </header>
      <div className="tabs">
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
    </section>
  )
}
