goog.module('firebaseui.auth.ui.adopter.TooltipMgr')

class TooltipMgr {


  /**
   * create popper instance
   */
  static createPopper(tipOwner, tipElement) {

    const style = window.getComputedStyle(tipElement)

    const option = {}
    let placement = style['--poppper-placement']
    if (placement) {
      placement = placement.trim()
      option.placement = placement 
    }
    let offset = style['--popper-offset'] 
    if (offset) {
      offset = JSON.parse(offset)
      const modifiers = option.modifires || []
      modifiers.push({
        name: 'offset',
        options: { offset }
      })
      option.modifiers = modifiers
    }

    return Popper.createPopper(tipOwner, tipElement, option)
  }
}

exports = TooltipMgr

// vi: se ts=2 sw=2 et:
