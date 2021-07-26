/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @fileoverview UI component for the list of supported identity providers. */

goog.module('firebaseui.auth.ui.page.ProviderSignIn');
goog.module.declareLegacyNamespace();


const Base = goog.require('firebaseui.auth.ui.page.Base');
const DomHelper = goog.requireType('goog.dom.DomHelper');
const idps = goog.require('firebaseui.auth.ui.element.idps');
const page = goog.require('firebaseui.auth.soy2.page');
const TooltipMgr = goog.require(
  'firebaseui.auth.ui.adopter.ProviderTooltipMgr') 
const RadioButtons = goog.require(
  'firebaseui.auth.ui.adopter.RadioButtons')

/** UI component that displays a list of supported identity providers. */
class ProviderSignIn extends Base {


  /**
   * get sign in button
   */
  get signInButton() {
    return this.getElementByClass('firebaseui-id-sign-in') 
  }

  /**
   * @param {function(string)} onIdpClick Callback to invoke when the user
   *     clicks one IdP button.
   * @param {!Array<!Object>} providerConfigs The provider configs of the IdPs
   *     to display.
   * @param {?function()=} opt_tosCallback Callback to invoke when the ToS link
   *     is clicked.
   * @param {?function()=} opt_privacyPolicyCallback Callback to invoke when
   *     the Privacy Policy link is clicked.
   * @param {?DomHelper=} domHelper Optional DOM helper.
   */
  constructor(
      onIdpClick, providerConfigs, opt_tosCallback, opt_privacyPolicyCallback,
      domHelper = undefined) {
    
    super(
        page.providerSignIn,
        { providerConfigs }, domHelper, 'providerSignIn', {
          tosCallback: opt_tosCallback,
          privacyPolicyCallback: opt_privacyPolicyCallback,
        });
    this.tooltipMgr_ = new TooltipMgr()
    this.radioButtons_ = new RadioButtons()
    this.onIdpClick_ = onIdpClick;
    this.activeChanged_ = null
    this.signInButtonHdlr_ = null
  }

  /** @override */
  enterDocument() {
    idps.initIdpList.bind(this)(this.onIdpClick_);

    const self = this
    this.activeChanged_ = (event) => { 
      self.onActiveRadioChanged(event)
    }


    this.singInButtonHdlr_ = (event) => {
      self.onSignIn(event)
    }
    this.tooltipMgr_.bind(
      this, this.templateData_.providerConfigs, this.injectedData_)
    super.enterDocument();
    this.radioButtons_.bind(this,
      '.firebaseui-idp-container',
      '.firebaseui-idp-container .firebaseui-idp-radio')
    this.radioButtons_.addEventListener('active', this.activeChanged_)

   
    const signInButton = this.signInButton  
    if (signInButton) {
      signInButton.addEventListener(
        'click',
        this.singInButtonHdlr_)
      signInButton.addEventListener(
        'keydown',
        this.singInButtonHdlr_)
    }
    this.syncSignInButtonWithRadioStatus()
  }

  /** @override */
  disposeInternal() {

    const signInButton = this.signInButton  
    if (signInButton) {
      signInButton.removeEventListener(
        'click',
        this.singInButtonHdlr_)
      signInButton.removeEventListener(
        'keydown',
        this.singInButtonHdlr_)
    }
    this.radioButtons_.removeEventListener('active', this.activeChanged_)
    this.radioButtons_.unbind()
    this.tooltipMgr_.unbind(this)
    this.onIdpClick_ = null;
    this.activeChanged_ = null
    this.singInButtonHdlr_ = null
    super.disposeInternal();
  }


  /**
   * handle radio changed
   */
  onActiveRadioChanged(event) {
    if ('active' == event.type) {
      this.syncSignInButtonWithRadioStatus()
    }
  }

  /**
   * synchronize button status with radio selection status
   */
  syncSignInButtonWithRadioStatus() {
    const signInButton = this.signInButton
    if (signInButton) {
      const radioButtons = this.radioButtons_
      const activeButton = radioButtons.activeButton
      signInButton.disabled = activeButton ? false : true
    } 
  }


  /**
   * handle event to sign in
   */
  onSignIn(event) {
    let doSignIn = false
    if (event.type == 'keydown') {
      doSignIn = event.code == 'Enter'
    } else {
      doSignIn = event.type == 'click'
    }
    if (doSignIn) {
      event.preventDefault()
      this.signIn()
    }
  }

  /**
   * start sign in
   */
  signIn() {
    const radioButtons = this.radioButtons_
    const activeButton = radioButtons.activeButton
    if (activeButton) {
      const providerId = activeButton.dataset.providerId
      if (providerId) {
        this.onIdpClick_(providerId)
      }
    }
  }
}


exports = ProviderSignIn;
// vi: se ts=2 sw=2 et:
