goog.module('firebaseui.auth.ui.element.PasswordRecovery')

/**
 * password recovery user interface
 */
class PasswordRecovery {

  /**
   * recovery ui
   */
  get recoveryUi() {
    const owner = this.recoveryOwner
    let result = undefined 
    if (owner) {
      result = owner.querySelector('.firebaseui-forgot-password')
    }
    return result
  }

  /**
   * constructor
   */
  constructor() {
  }


  /**
   * bind this object into html elements
   */
  bind(recoveryOwner, handler) {
    this.recoveryOwner = recoveryOwner

    this.recoveryHdlr = e => {
      handler(e)
    }

    const recoveryUi = this.recoveryUi 
    if (recoveryUi) {
      recoveryUi.addEventListener('click', this.recoveryHdlr)
    }
  }


  /**
   * unbind this object from html elements
   */
  unbind() {
    if (recoveryUi) {
      recoveryUi.removeEventListener('click', this.recoveryHdlr)
    }
    this.recoverHdlr = null 
  }
}


exports = PasswordRecovery 
// vi: se ts=2 sw=2 et:
