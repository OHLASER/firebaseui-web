goog.module('firebaseui.auth.ui.adopter.ProviderTooltipMgr')
goog.require('goog.soy');
const tooltipTemplate = goog.require('firebaseui.auth.soy2.tooltip')

/**
 * manage provider tool tip
 */
class ProviderTooltipMgr {

  /**
   * constructor
   */
  constructor() {
    this.popperBind = {}

    
  }


  /**
   * attach tooltip into each id provider user interface.
   */
  bind(idpsContainer,
    providerConfigs,
    injectedData) {

    const self = this
    this.tooltipHdlr = evt => self.onEventToShowTooltip(evt)
    const htmlElement = idpsContainer.getContentElement()
    providerConfigs.forEach(elem => {
      const providerId = elem.providerId
      let providerName = undefined
      if (elem.providerName) {
        providerName = elem.providerName
      } else {
        providerName = injectedData.defaultProviderNames[providerId]
      } 
      let fullLabel = undefined
      if (elem.fullLabel) {
        fullLabel = elem.fullLabel
      }

      const provElem = htmlElement.querySelector(
        `.tooltip-owner[data-provider-id="${providerId}"]`)

      if (provElem) {
        const tooltipElem = goog.soy.renderAsElement(
          tooltipTemplate.idpButtonTooltip,
          { providerConfig: elem }, injectedData, idpsContainer.getDomHelper())

        htmlElement.append(tooltipElem)
        this.bindPopper(provElem, tooltipElem)
      }
    })
  }

  /**
   * bind popper
   */
  bindPopper(provElem, tooltipElement) {
    const instance = Popper.createPopper(
      provElem, tooltipElement)
    this.popperBind[provElem.dataset['providerId']] = instance
    provElem.addEventListener('mouseenter', this.tooltipHdlr)
    provElem.addEventListener('mouseleave', this.tooltipHdlr)
  }

  /**
   * detach tooltip from each id provider user interface.
   */
  unbind(idpsContainer) {
    for (let key in this.popperBind) {
      const instance = this.popperBind[key]
      instance.state.elements.reference.removeEventListener(
        'mouseenter', this.tooltipHdlr)
      instance.state.elements.reference.removeEventListener(
        'mouseleave', this.tooltipHdlr) 
      instance.destroy()
    }
    delete this.tooltipHdlr
  }


  /**
   * handle event to show tooltip or hide
   */
  onEventToShowTooltip(event) {
    const instance = this.popperBind[
      event.currentTarget.dataset['providerId']] 
    if (instance) {
      const popper = instance.state.elements.popper      
      if (event.type == 'mouseenter') {
        popper.classList.add('show')
      } else {
        popper.classList.remove('show')
      }
    }
  }
}


exports = ProviderTooltipMgr

// vi: se ts=2 sw=2 et:
