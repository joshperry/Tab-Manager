/*global chrome*/
import React, { useState, useRef, useLayoutEffect } from 'react'

// Favicons for builtin chrome location views (i.e. `chrome://extensions`)
const chromeFavIcons = ['bookmarks', 'chrome', 'crashes', 'downloads', 'extensions', 'flags', 'history', 'settings']

export default (props) => {
  // States
  const [draggingOver, setDraggingOver] = useState('') // Dragging state
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }) // Element layout dims

  // A reference to the tab element
  const selfRef = useRef()

  // Get dimensions from element once layout completes
  useLayoutEffect(() => {
    if(selfRef.current) {
      setDimensions({
        width: selfRef.current.clientWidth,
        height: selfRef.current.clientHeight
      })
    }
  }, [])


  /*
   * Event Handlers
   */

  // When the tab is clicked, focus it and its containing window
  const click = (e) => {
		if(e.button === 1) {
			props.middleClick(props.tab.id)
		} else if(e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey) {
			props.select(props.tab.id)
		} else {
			chrome.tabs.update(props.tab.id, { selected: true })
			chrome.windows.update(props.window.id, { focused: true })
		}
	}

  // Notify parent when a drag begins on this tab
  const dragStart = (e) => {
		props.drag(e, props.tab.id)
	}

  // When another tab is dragged over this one, shift it the appropriate direction
  const dragOver = (e) => {
		e.nativeEvent.preventDefault()

		const before = draggingOver

		if(props.layout === 'vertical') {
			setDraggingOver(e.nativeEvent.offsetY > dimensions.height / 2 ? 'bottom' : 'top')
		} else {
			setDraggingOver(e.nativeEvent.offsetX > dimensions.width / 2 ? 'right' : 'left')
		}

    //FIXME: refactor from forceUpdate
    //if(before != draggingOver) forceUpdate()
	}

  // When another tab is no longer being dragged over this, unshift it
  const dragOut = () => {
		setDraggingOver('')
    //FIXME: refactor from forceUpdate
    //forceUpdate()
	}

  // Notify the parent when another tab is dropped on this one so it can be inserted
  const drop = (e) => {
		const before = draggingOver === 'top' || draggingOver === 'left'
		setDraggingOver('')
		props.drop(props.tab.id, before)
	}

  // Get the url for the favicon of this tab
  const resolveFavIconUrl = () => {
		if(props.tab.url.indexOf('chrome://') !== 0){
			return props.tab.favIconUrl ? `url(${props.tab.favIconUrl})` : ''
		}else{
			const iconName = props.tab.url.slice(9).match(/^\w+/g)
			return (!iconName || chromeFavIcons.indexOf(iconName[0]) < 0) ? '' : `url(../images/chrome/${iconName[0]}.png)`
		}
	}


  /*
   * Tab component
   */
  return (
    <div
			className={`icon tab ${props.selected && 'selected '} ${props.hidden && 'hidden '} ${props.layout === 'vertical' && 'full '} ${props.tab.incognito && 'incognito '} ${draggingOver}`}
			style={{
				backgroundImage: resolveFavIconUrl(),
				paddingLeft: props.layout === 'vertical' ? '20px' : ''
			}}
			title={props.tab.title}
      ref={selfRef}
			onClick={click}
			onDragStart={dragStart}
			onDragOver={dragOver}
			onDragLeave={dragOut}
			onDrop={drop}
			draggable="true"
    >
      <div className="tabtitle" style={{ display: props.layout !== 'vertical' && 'none' }}>{props.tab.title}</div>
      <div className="limiter" />
    </div>
  )
}
