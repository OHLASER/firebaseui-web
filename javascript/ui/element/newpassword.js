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
 * @fileoverview Binds handlers for the new password UI element.
 */

goog.provide('firebaseui.auth.ui.element.newPassword');

goog.require('firebaseui.auth.soy2.strings');
goog.require('firebaseui.auth.ui.element');
goog.require('goog.dom.classlist');
goog.requireType('goog.ui.Component');


goog.scope(function() {
var element = firebaseui.auth.ui.element;


/**
 * @return {Element} The new password input.
 * @this {goog.ui.Component}
 */
element.newPassword.getNewPasswordElement = function() {
  return this.getElementByClass('firebaseui-id-new-password');
};


/**
 * @return {Element} The toggle button to show or hide the password text.
 * @this {goog.ui.Component}
 */
element.newPassword.getPasswordToggleElement = function() {
  return this.getElementByClass('firebaseui-id-password-toggle');
};




/** @private {string} The CSS class for the "visiblility on" eye icon. */
var CLASS_TOGGLE_ON_ = 'firebaseui-input-toggle-on';


/** @private {string} The CSS class for the "visiblility off" eye icon. */
var CLASS_TOGGLE_OFF_ = 'firebaseui-input-toggle-off';


/**
 * @private {string} The CSS class for the eye icon when the input is
 *     focused.
 */
var CLASS_TOGGLE_FOCUS_ = 'firebaseui-input-toggle-focus';


/**
 * @private {string} The CSS class for the eye icon when the input is not
 *     focused.
 */
var CLASS_TOGGLE_BLUR_ = 'firebaseui-input-toggle-blur';


/**
 * Toggles the visibility of the password text.
 * @this {goog.ui.Component}
 */
element.newPassword.togglePasswordVisible = function() {
  this.isPasswordVisible_ = !this.isPasswordVisible_;

  var toggleElement = element.newPassword.getPasswordToggleElement.call(this);
  var newPasswordElement = element.newPassword.getNewPasswordElement.call(this);

  if (this.isPasswordVisible_) {
    newPasswordElement['type'] = 'text';
    goog.dom.classlist.add(toggleElement, CLASS_TOGGLE_OFF_);
    goog.dom.classlist.remove(toggleElement, CLASS_TOGGLE_ON_);
  } else {
    newPasswordElement['type'] = 'password';
    goog.dom.classlist.add(toggleElement, CLASS_TOGGLE_ON_);
    goog.dom.classlist.remove(toggleElement, CLASS_TOGGLE_OFF_);
  }
  if (element.newPassword.isFocusTogglePassword.call(this)) {
    newPasswordElement.focus();
  }
};


/**
 * @return {Element} The error message.
 * @this {goog.ui.Component}
 */
element.newPassword.getNewPasswordErrorElement = function() {
  return this.getElementByClass('firebaseui-id-new-password-error');
};

/**
 * @return {Element} The error message container.
 * @this {goog.ui.Component}
 */
element.newPassword.getNewPasswordErrorContainerElement = function() {
  return this.getElement().querySelector(
    '.firebaseui-error-wrapper.new-password');
};


/**
 * @return {Boolean} true if you need to focus password input when toggle 
 * password visiblility.
 */
element.newPassword.isFocusTogglePassword = function() {

  const elem =this.getNewPasswordElement()

  const style = window.getComputedStyle(elem)

  const visibleStr = style.getPropertyValue(
    '--focus-when-toggle-password-visible')

  let result = true 
  if (visibleStr) {
    result = visibleStr.trim() == 'true'
  }
  return result
}



/**
 * Validates the password field and shows/clears the error message if necessary.
 * @param {Element} newPasswordElement The new password input.
 * @param {Element} errorElement The error panel.
 * @return {boolean} True if fields are valid.
 * @private
 */
element.newPassword.validate = function(
  newPasswordElement, errorElement, errorContainerElement) {
  var password = element.getInputValue(newPasswordElement) || '';
  if (!password) {
    element.setValid(newPasswordElement, false);
    element.show(errorElement,
      firebaseui.auth.soy2.strings.errorMissingPassword().toString(),
      errorContainerElement);
    return false;
  } else {
    element.setValid(newPasswordElement, true);
    element.hide(errorElement, errorContainerElement);
    return true;
  }
};


/**
 * Initializes the new password element.
 * @this {goog.ui.Component}
 */
element.newPassword.initNewPasswordElement = function(opt_onEnter) {
  this.isPasswordVisible_ = false;

  var newPasswordElement = element.newPassword.getNewPasswordElement.call(this);
  newPasswordElement['type'] = 'password';

  var errorElement = element.newPassword.getNewPasswordErrorElement.call(this);
  const errorContainerElement =
    element.newPassword.getNewPasswordErrorContainerElement.call(this)
  element.listenForInputEvent(this, newPasswordElement, function(e) {
    // Clear but not show error on-the-fly.
    if (element.isShown(errorElement, errorContainerElement)) {
      element.setValid(newPasswordElement, true, errorContainerElement);
      element.hide(errorElement, errorContainerElement);
    }
  });
  if (opt_onEnter) {
    element.listenForEnterEvent(this, newPasswordElement, function(e) {
      opt_onEnter()
    })
  }

  var toggleElement = element.newPassword.getPasswordToggleElement.call(this);
  goog.dom.classlist.add(toggleElement, CLASS_TOGGLE_ON_);
  goog.dom.classlist.remove(toggleElement, CLASS_TOGGLE_OFF_);

  element.listenForFocusInEvent(this, newPasswordElement, function(e) {
    goog.dom.classlist.add(toggleElement, CLASS_TOGGLE_FOCUS_);
    goog.dom.classlist.remove(toggleElement, CLASS_TOGGLE_BLUR_);
  });

  element.listenForFocusOutEvent(this, newPasswordElement, function(e) {
    goog.dom.classlist.add(toggleElement, CLASS_TOGGLE_BLUR_);
    goog.dom.classlist.remove(toggleElement, CLASS_TOGGLE_FOCUS_);
  });

  element.listenForActionEvent(this, toggleElement,
      goog.bind(element.newPassword.togglePasswordVisible, this));
};


/**
 * Gets the new password.
 * It validates the fields and shows/clears the error message if necessary.
 * @return {?string} The new password.
 * @this {goog.ui.Component}
 */
element.newPassword.checkAndGetNewPassword = function() {
  var newPasswordElement = element.newPassword.getNewPasswordElement.call(this);
  var errorElement = element.newPassword.getNewPasswordErrorElement.call(this);
  const errorContainerElement =
    element.newPassword.getNewPasswordErrorContainerElement.call(this)

  let valid = undefined
  if (typeof this.validatePassword  === 'function') {
    valid = this.validatePassword(
      newPasswordElement, errorElement, errorContainerElement) 
  } else {
    valid = element.newPassword.validate(
      newPasswordElement, errorElement, errorContainerElement)
  }

  if (valid) {
    return element.getInputValue(newPasswordElement);
  }
  return null;
};
}); // goog.scope
// vi: se ts=2 sw=2 et:
