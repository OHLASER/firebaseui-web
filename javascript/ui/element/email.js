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
 * @fileoverview Binds handlers for email UI element.
 */

goog.provide('firebaseui.auth.ui.element.email');

goog.require('firebaseui.auth.soy2.strings');
goog.require('firebaseui.auth.ui.element');
goog.require('goog.asserts');
goog.require('goog.format.EmailAddress');
goog.require('goog.string');
goog.require('goog.ui.Component');


goog.scope(function() {
var element = firebaseui.auth.ui.element;
var strings = firebaseui.auth.soy2.strings;


/**
 * @return {Element} The email input.
 * @this {goog.ui.Component}
 */
element.email.getEmailElement = function() {
  return this.getElementByClass('firebaseui-id-email');
};


/**
 * @return {Element} The error panel.
 * @this {goog.ui.Component}
 */
element.email.getEmailErrorElement = function() {
  return this.getElementByClass('firebaseui-id-email-error');
};


/**
 * @return {Element} The error panel.
 * @this {goog.ui.Component}
 */
element.email.getEmailErrorContainerElement = function() {
  return this.getElement().querySelector('.firebaseui-error-wrapper.email')
};



/**
 * Validates the field and shows/clears the error message if necessary.
 * @param {Element} emailElement The email input.
 * @param {Element} errorElement The error panel.
 * @param {Element} errorContainerElement the error panel
 * @return {boolean} True if the field is valid.
 */
element.email.validate = function(
  emailElement, errorElement, errorContainerElement) {
  var value = element.getInputValue(emailElement) || '';
  if (!value) {
    element.setValid(emailElement, false);
    element.show(errorElement, strings.errorMissingEmail().toString(),
      errorContainerElement);
    return false;
  } else if (!goog.format.EmailAddress.isValidAddrSpec(value)) {
    element.setValid(emailElement, false);
    element.show(errorElement, strings.errorInvalidEmail().toString(),
      errorContainerElement);
    return false;
  } else {
    element.setValid(emailElement, true);
    element.hide(errorElement, errorContainerElement);
    return true;
  }
};


/**
 * Initializes the email element.
 * @param {function()=} opt_onEnter Callback to invoke when the ENTER key is
 *     detected.
 * @this {goog.ui.Component}
 */
element.email.initEmailElement = function(opt_onEnter) {
  var emailElement = element.email.getEmailElement.call(this);
  const errorContainerElement = 
    element.email.getEmailErrorContainerElement.call(this);
  var errorElement = element.email.getEmailErrorElement.call(this);
  element.listenForInputEvent(this, emailElement, function(e) {
    // Clear the error message.
    if (element.isShown(errorElement, errorContainerElement)) {
      element.setValid(emailElement, true, errorContainerElement);
      element.hide(errorElement, errorContainerElement);
    }
  });
  if (opt_onEnter) {
    element.listenForEnterEvent(this, emailElement, function(e) {
      opt_onEnter();
    });
  }
};


/**
 * @return {string} The email in the input.
 * @this {goog.ui.Component}
 */
element.email.getEmail = function() {
  return goog.string.trim(
      element.getInputValue(element.email.getEmailElement.call(this)) || '');
};


/**
 * Gets the email address.
 * It validates the field and shows/clears the error message if necessary.
 * @return {?string} The email address.
 * @this {goog.ui.Component}
 */
element.email.checkAndGetEmail = function() {
  var emailElement = element.email.getEmailElement.call(this);
  const errorContainerElement =
    element.email.getEmailErrorContainerElement.call(this)
  var errorElement = element.email.getEmailErrorElement.call(this);
  let valid = false
  if (typeof this.validateEmail === 'function') {
    valid = this.validateEmail(
      emailElement, errorElement, errorContainerElement)
  } else {
    valid = element.email.validate(
      emailElement, errorElement, errorContainerElement)
  }

  if (valid) {
    return goog.string.trim(
        goog.asserts.assert(element.getInputValue(emailElement)));
  }
  return null;
};

});
