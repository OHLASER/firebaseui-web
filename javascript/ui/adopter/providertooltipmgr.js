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
    console.log('bind')

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
      console.log(`prov: ${provElem}`)

      if (provElem) {
        const tooltipElem = goog.soy.renderAsElement(
          tooltipTemplate.idpButtonTooltip,
          { providerConfig: elem }, injectedData, idpsContainer.getDomHelper())

        htmlElement.append(tooltipElem)
        this.bindPopper(provElem, tooltipElem)
      }
    })
  }

  bindPopper(provElem, tooltipElement) {
    this.popperBind[provElem.dataset['providerId']] = Popper.createPopper(
      provElem, tooltipElement) 

  }




  /**
   * detach tooltip from each id provider user interface.
   */
  unbind(idpsContainer) {
    idpsContainer.getElementsByClass(
      'firebaseui-id-idp-button').forEach(elem => {
      console.log(`target: $elem`)
    })

    console.log('unbind')
  }
  
}


exports = ProviderTooltipMgr

// vi: se ts=2 sw=2 et:
