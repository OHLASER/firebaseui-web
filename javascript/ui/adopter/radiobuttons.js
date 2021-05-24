goog.module('firebaseui.auth.ui.adopter.RadioButtons')


/**
 * pseudo button management
 */
class RadioButtons {


  /**
   * get radio buttons properties
   */
  get radioButtons() {
    const radioOwner = this.radioOwner
    return radioOwner.querySelectorAll(this.radioSelector)
  }

  /**
   * get radio pane
   */
  get radioPane() {
    const radioOwner = this.radioOwner
    return radioOwner.querySelector(this.radioPaneSelector)
  }


  /**
   * active button
   */
  get activeButton() {
    const buttons = this.radioButtons 
    let result = undefined
    for (let idx = 0; idx < buttons.length; idx++) {
      const button = buttons[idx]
      if (button.classList.contains('active')) {
        result = button
        break
      }
    }
    return result
  }
  /**
   * active button index
   */
  get activeButtonIndex() {
    const buttons = this.radioButtons 
    let result = -1
    for (let idx = 0; idx < buttons.length; idx++) {
      const button = buttons[idx]
      if (button.classList.contains('active')) {
        result = idx 
        break
      }
    }
    return result
  }



  /**
   * constructor
   */
  constructor() {
    this.clickHdlr = null
    this.keyInputHdlr = null
    this.radioPaneSelector = null
    this.radioSelector = null
    this.radioOwner = null
    this.listeners = {}
  }


  /**
   * attach this object into the element
   */
  bind(radioOwner, 
    radioPaneSelector,
    radioSelector) {
    const self = this

    this.clickHdlr = evt=> self.onClick(evt)
    this.keyInputHdlr = evt => self.onKeyInput(evt)

    this.radioPaneSelector = radioPaneSelector
    this.radioSelector = radioSelector
    this.radioOwner = radioOwner.getContentElement()
    const elements = this.radioButtons
    elements.forEach(elem => self.bindElement(elem))
    const radioPane = this.radioPane
    if (radioPane != null) {
      radioPane.addEventListener('keydown', this.keyInputHdlr)
    }
  } 


  /**
   * detach this object from  the element
   */
  unbind(radioOwner) {
    const radioPane = this.radioPane
    if (radioPane != null) {
      radioPane.removeEventListener('keydown', this.keyInputHdlr)
    }
    const elements = this.radioButtons
    const self = this
    elements.forEach(elem => self.unbindElement(elem))
    this.clickHdlr = null
    this.keyInputHdlr = null
    this.radioPaneSelector = null
    this.radioSelector = null
    this.radioOwner = null
  }


  /**
   * add event listener
   */
  addEventListener(eventName, listener) {
    if (listener != null) {
      let listeners = this.listeners[eventName]
      if (!listeners) {
        listeners = []
        this.listeners[eventName] = listeners
      }
      listeners.push(listener)
    }
  }

  /**
   * remove event listener
   */
  removeEventListener(eventName, listener) {
    if (listener != null) {
      let listeners = this.listeners[eventName]
      if (listeners) {
        const idx = listeners.indexOf(listener)
        if (idx >= 0) {
          listeners.splice(idx, 1)
        }
      }
    }
  }


  /**
   * notify event
   */
  notifyEvent(eventName, oldValue, newValue) {
    const listeners = this.listeners[eventName]
    if (listeners) {
      const sender = this
      listeners.forEach(elem => {
          elem({
            type: eventName,
            sender,
            oldValue,
            newValue
          }) 
      }) 
    }
  }



  /**
   * bind this object into the element
   */
  bindElement(element) {
    element.addEventListener('click', this.clickHdlr)
  }

  /**
   * detach this object from  the element
   */
  unbindElement(element) {
    element.removeEventListener('click', this.clickHdlr)
  }

  /**
   * handle click event
   */
  onClick(evt) {
    this.setElementActive(evt.currentTarget)
  } 

  /**
   * handle key input
   */
  onKeyInput(evt) {
    if (!event.defaultPrevented) {
      switch (evt.key) {
      case 'Down':
      case 'ArrowDown':
      case 'Right':
      case 'ArrowRight':
        this.selectElement(this.activeButtonIndex + 1)  
        evt.preventDefault()
        break; 
      case 'Up':
      case 'ArrowUp':
      case 'Left':
      case 'ArrowLeft':
        this.selectElement(this.activeButtonIndex - 1)  
        evt.preventDefault()
        break; 
      }
    } 
  }


  /**
   * select element at a index
   */
  selectElement(idx) {
    const radioButtons = this.radioButtons 
    this.setElementActive(
      radioButtons[(idx + radioButtons.length) % radioButtons.length])
  }


  /**
   * set element active
   */
  setElementActive(element) {
    const activeButton = this.activeButton
    let notify = false
    if (element != activeButton) {
      element.classList.add('active')
      notify = true
    }
    if (activeButton) {
      activeButton.classList.remove('active')
    }
    if (notify) {
      this.notifyEvent('active', activeButton, element)
    }
  }
}

exports = RadioButtons 
// vi: se ts=2 sw=2 et:
