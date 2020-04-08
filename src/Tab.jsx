import React, { useState, useRef, useEffect } from 'react'
import classnames from 'classnames'

import { windows, tabs } from './chromewrap'

import './styles/tab.scss'

// Favicons for builtin chrome location views (i.e. `chrome://extensions`)
const chromeFavIcons = ['bookmarks', 'chrome', 'crashes', 'downloads', 'extensions', 'flags', 'history', 'settings']

export default (props) => {
  /*
   * State
   */
  const [draggingOver, setDraggingOver] = useState('') // Dragging state
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }) // Element layout dims

  // A reference to the tab element
  const selfRef = useRef()

  // Get the dimensions of the tab element once render completes
  useEffect(() => {
    setDimensions({
      width: selfRef.current.clientWidth,
      height: selfRef.current.clientHeight
    })
  }, [])


  /*
   * Event Handlers
   */

  // When the tab is clicked, focus it and its containing window
  const click = (e) => {
		if(e.button === 1 || e.nativeEvent.altKey) {
      tabs.remove(props.tab.id)
		} else if(e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey) {
			props.select(props.tab.id)
		} else {
			tabs.update({ selected: true }, props.tab.id)
			windows.update({ focused: true }, props.tab.windowId)
		}
	}

  // Notify parent when a drag begins on this tab
  const dragStart = (e) => {
		props.drag(e, props.tab.id)
	}

  // When another tab is dragged over this one, shift it the appropriate direction
  const dragOver = (e) => {
		e.nativeEvent.preventDefault()

		if(props.layout === 'vertical') {
			setDraggingOver(e.nativeEvent.offsetY > dimensions.height / 2 ? 'bottom' : 'top')
		} else {
			setDraggingOver(e.nativeEvent.offsetX > dimensions.width / 2 ? 'right' : 'left')
		}
	}

  // When another tab is no longer being dragged over this, unshift it
  const dragOut = () => {
		setDraggingOver('')
	}

  // Notify the parent when another tab is dropped on this one so it can be inserted
  const drop = (e) => {
		const before = draggingOver === 'top' || draggingOver === 'left'
		setDraggingOver('')
		props.drop(props.tab.id, before)
	}

  // Get the url for the favicon of this tab
  const resolveFavIconUrl = (url, favurl) => {
		if(url.indexOf('chrome://') !== 0){
			return favurl ? `url(${favurl})` : ''
		}else{
			const iconName = url.slice(9).match(/^\w+/g)
			return (!iconName || chromeFavIcons.indexOf(iconName[0]) < 0) ? '' : `url(../images/chrome/${iconName[0]}.png)`
		}
	}


  /*
   * Tab component
   */
  return (
    <div
      className={classnames('icon', 'tab', draggingOver, {
        selected: props.tab.selected,
        incognito: props.tab.incognito,
      })}
			style={{ backgroundImage: resolveFavIconUrl(props.tab.url, props.tab.favIconUrl) }}
			title={props.tab.title}
      ref={selfRef}
			onClick={click}
			onDragStart={dragStart}
			onDragOver={dragOver}
			onDragLeave={dragOut}
			onDrop={drop}
			draggable="true"
    >
      <div className="tabtitle" >{props.tab.title}</div>
      <div className="limiter" />
    </div>
  )
}
