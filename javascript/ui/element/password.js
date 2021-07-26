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

/**
 * @fileoverview Binds handlers for the password UI element.
 */

goog.provide('firebaseui.auth.ui.element.password');

goog.require('firebaseui.auth.soy2.strings');
goog.require('firebaseui.auth.ui.element');
goog.require('goog.ui.Component');


goog.scope(function() {
var element = firebaseui.auth.ui.element;

/** @private {string} The CSS class for the "visiblility on" eye icon. */
const CLASS_TOGGLE_ON_ = 'firebaseui-input-toggle-on';


/** @private {string} The CSS class for the "visiblility off" eye icon. */
const CLASS_TOGGLE_OFF_ = 'firebaseui-input-toggle-off';


/**
 * @return {Element} The password input.
 * @this {goog.ui.Component}
 */
element.password.getPasswordElement = function() {
  return this.getElementByClass('firebaseui-id-password');
};

/**
 * @return {Element} The toggle button to show or hide the password text.
 * @this {goog.ui.Component}
 */
element.password.getPasswordToggleElement = function() {
  return this.getElementByClass('firebaseui-id-password-toggle');
};


/**
 * @return true if password is visible
 */
element.password.isVisiblePassword = function() {
  const elem = element.password.getPasswordElement.call(this)
  return elem.getAttribute('type')  == 'text'
}

/**
 * @param {Boolean} visible
 */
element.password.setVisiblePassword = function(visible) {

  if (element.password.isVisiblePassword.call(this) != visible) {
    const elem = element.password.getPasswordElement.call(this)
    const toggleElem = element.password.getPasswordToggleElement.call(this)
    let newAttribute = 'password' 
    let classes = [CLASS_TOGGLE_ON_, CLASS_TOGGLE_OFF_]
    if (visible) {
      newAttribute = 'text'
      classes = [CLASS_TOGGLE_OFF_, CLASS_TOGGLE_ON_]
    } 
    elem.setAttribute('type', newAttribute)
    goog.dom.classlist.add(toggleElem, classes[0]);
    goog.dom.classlist.remove(toggleElem, classes[1]);
  }
}

/**
 * @return {Element} The error panel.
 * @this {goog.ui.Component}
 */
element.password.getPasswordErrorElement = function() {
  return this.getElementByClass('firebaseui-id-password-error');
};

/**
 * @return {Element} The error panel.
 * @this {goog.ui.Component}
 */
element.password.getPasswordErrorContainerElement = function() {
  return this.getElement().querySelector('.firebaseui-error-wrapper.password')
};


/**
 * Validates the field and shows/clears the error message if necessary.
 * @param {Element} passwordElement The password input.
 * @param {Element} errorElement The error panel.
 * @return {boolean} True if field is valid.
 * @private
 */
element.password.validate = function(
  passwordElement, errorElement, errorContainerElement) {
  var password = element.getInputValue(passwordElement);
  if (password) {
    element.setValid(passwordElement, true);
    element.hide(errorElement, errorContainerElement);
    return true;
  } else {
    element.setValid(passwordElement, false, errorContainerElement);
    element.show(errorElement,
        firebaseui.auth.soy2.strings.errorMissingPassword().toString(),
        errorContainerElement);
    return false;
  }
};


/**
 * Initializes the password element.
 * @this {goog.ui.Component}
 */
element.password.initPasswordElement = function() {
  var passwordElement = element.password.getPasswordElement.call(this);
  var errorElement = element.password.getPasswordErrorElement.call(this);
  const errorContainerElement =
    element.password.getPasswordErrorContainerElement.call(this)
  element.listenForInputEvent(this, passwordElement, function(e) {
    // Clear but not show error on-the-fly.
    if (element.isShown(errorElement, errorContainerElement)) {
      element.setValid(passwordElement, true, errorContainerElement);
      element.hide(errorElement, errorContainerElement);
    }
  });
  element.password.attachPasswordVisibleToggle.call(this)
};



/**
 * attach this object into toggle button to show password
 */
element.password.attachPasswordVisibleToggle = function() {
  const elem = element.password.getPasswordToggleElement.call(this)

  element.listenForActionEvent(this, elem,
    goog.bind(element.password.togglePasswordVisible, this))
}

/**
 * Toggles the visibility of the password text.
 * @this {goog.ui.Component}
 */
element.password.togglePasswordVisible = function() {
  const visible = element.password.isVisiblePassword.call(this)
  element.password.setVisiblePassword.call(this, !visible)
}


/**
 * detach this object from toggle button to show password
 */
element.password.detachPasswordVisibleToggle = function() {

  
}


/**
 * Gets the password.
 * It validates the field and shows/clears the error message if necessary.
 * @return {?string} The password.
 * @this {goog.ui.Component}
 */
element.password.checkAndGetPassword = function() {
  var passwordElement = element.password.getPasswordElement.call(this);
  var errorElement = element.password.getPasswordErrorElement.call(this);
  const errorContainerElement
    = element.password.getPasswordErrorContainerElement.call(this)
  
  let valid = false
  if (typeof this.validatePassword === 'function') {
    valid = this.validatePassword(
      passwordElement, errorElement, errorContainerElement)
  } else {
    valid = element.password.validate(
      passwordElement, errorElement, errorContainerElement)
  }
  if (valid) {
    return element.getInputValue(passwordElement);
  }
  return null;
};
});
// vi: se ts=2 sw=2 et:
