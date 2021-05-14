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

const cleanCSS = require('gulp-clean-css');
const closureBuilder = require('closure-builder');
const closureCompiler = require('gulp-closure-compiler');
const concatCSS = require('gulp-concat-css');
const cssInlineImages = require('gulp-css-inline-images');
const connect = require('gulp-connect');
const fse = require('fs-extra');
const flip = require('gulp-css-flip');
const gulp = require('gulp');
const path = require('path');
const sass = require('gulp-sass');
const streamqueue = require('streamqueue');
const util = require('gulp-util');

const glob = closureBuilder.globSupport();

// The optimization level for the JS compiler.
// Valid levels: WHITESPACE_ONLY, SIMPLE_OPTIMIZATIONS, ADVANCED_OPTIMIZATIONS.
// This can be passed in as a flag:
// $ gulp --compilation_level=WHITESPACE_ONLY
const OPTIMIZATION_LEVEL = util.env.compilation_level ||
    'ADVANCED_OPTIMIZATIONS';
// const OPTIMIZATION_LEVEL = util.env.compilation_level ||
//    'WHITESPACE_ONLY';


// Provides missing dialogPolyfill on window in cjs environments.
const DIALOG_POLYFILL = 'if(typeof window!==\'undefined\')' +
    '{window.dialogPolyfill=require(\'dialog-polyfill\');}';

// Provides missing dialogPolyfill on window for esm.
const ESM_DIALOG_POLYFILL = 'if(typeof window!==\'undefined\')' +
    '{window.dialogPolyfill=dialogPolyfill;}';

// Using default import if available.
const DEFAULT_IMPORT_FIX = 'if(typeof firebase.default!==\'undefined\')' +
    '{firebase=firebase.default;}';

// The Material Design Lite components needed by FirebaseUI.
const MDL_COMPONENTS = [
  'mdlComponentHandler',
  'button/button',
  'progress/progress',
  'spinner/spinner',
  'textfield/textfield'
];

// The external dependencies needed by FirebaseUI as ES module imports.
const ESM_DEPS = [
  'import firebase from \'firebase/app\'',
  'import \'firebase/auth\'',
  'import dialogPolyfill from \'dialog-polyfill\'',
].concat(MDL_COMPONENTS.map(component => `import \'material-design-lite/src/${component}\'`));

// The external dependencies needed by FirebaseUI as CommonJS modules.
const CJS_DEPS = [
  'node_modules/dialog-polyfill/dialog-polyfill.js'
].concat(MDL_COMPONENTS.map(component => `node_modules/material-design-lite/src/${component}.js`));

// Import esm modules.
const ESM_IMPORT = ESM_DEPS.join(';') + ';';

// Export firebaseui.auth module.
const ESM_EXPORT = 'var auth = firebaseui.auth;' +
    'export { auth } ;';

// The path to Closure Compiler.
const COMPILER_PATH = 'node_modules/google-closure-compiler-java/compiler.jar';

// The path to the temporary directory where intermediate results are stored.
const TMP_ROOT_DIR = 'out';

// The path to the temporary directory where intermediate results are stored.
const DEST_DIR = 'dist';

// The locale that would be produced with no XTBs.
const DEFAULT_LOCALE = 'en';

// The list of all locales that are supported.
const ALL_LOCALES = ['ar-XB', 'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'en',
    'en-GB', 'en-XA', 'es-419', 'es', 'fa', 'fi', 'fil', 'fr', 'hi', 'hr', 'hu',
    'id', 'it', 'iw', 'ja', 'ko', 'lt', 'lv', 'nl', 'no', 'pl', 'pt-PT',
    'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'vi',
    'zh-CN', 'zh-TW'];

// Default arguments to pass into Closure Compiler.
const COMPILER_DEFAULT_ARGS = {
  compilation_level: OPTIMIZATION_LEVEL,
  language_out: 'ES5'
};

// The typescript definitions file path.
const TYPES_FILE = './types/index.d.ts';

// The externs directory files.
const EXTERNS_FILES = './externs/*.js';


/**
 * get soy file compile opion
 */
function getSoyCompileOption(id) {

  let idStr = undefined
  if (id == '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }

  const result = {
    name: 'soy_files',
    srcs: glob([
      `soy${idStr}/*.soy`
    ]),
    out: getSoyIntermidiateDirectory(id),
    options: {
      soy: {
        shouldGenerateGoogMsgDefs: true,
        bidiGlobalDir: 1
      }
    },
  }

  return result
}

/**
 * get soy compiler output directory
 */
function getSoyIntermidiateDirectory(id) {
  let idStr = undefined
  if ('' === id) {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  return `${TMP_ROOT_DIR}`
}

/**
 * got soy compiler processed intermidiate directory
 */
function getSoyProcessedIntermidiateDirectory(id) {
  let idStr = undefined
  if ('' === id) {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  return `${TMP_ROOT_DIR}/soy${idStr}`
}

// For minified builds, wrap the output so we avoid leaking global variables.
function getOutputWrapper(sourceMap) {
  let result = undefined
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY'){
    result = `%output%//# sourceMappingURL=${path.basename(sourceMap)}`
  } else {
    result = '(function() { %output% }).apply('
      + 'typeof global !== \'undefined\' '
      + '? global : typeof self !== \'undefined\' '
      + '? self : window );'
      + `//# sourceMappingURL=${path.basename(sourceMap)}`;
  }
  return result
}



// Adds the cjs module requirement and exports firebaseui.
function getNpmModuleWrapper(sourceMap) {
  let result = undefined
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY') {
    result = 'var firebase=require(\'firebase/app\');'
      + 'require(\'firebase/auth\');'
      + DEFAULT_IMPORT_FIX
      + '%output%'
      + DIALOG_POLYFILL
      + 'module.exports=firebaseui;'
      + `//# sourceMappingURL=${path.basename(sourceMap)}`;

  } else { 
    result = '(function() { var firebase=require(\'firebase/app\');'
      + 'require(\'firebase/auth\');'
      + DEFAULT_IMPORT_FIX
      + '%output% '
      + DIALOG_POLYFILL
      + '})();'
      + 'module.exports=firebaseui;'
      + `//# sourceMappingURL=${path.basename(sourceMap)}`;
  }
  return result
}

// Adds the module requirement and exports firebaseui.
function getEsmModuleWrapper(sourceMap) {
  let result = undefined
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY') {
    reuslt = ESM_IMPORT
      + '%output%'
      + ESM_DIALOG_POLYFILL
      + ESM_EXPOR
      + `//# sourceMappingURL=${path.basename(sourceMap)}`
  } else {
    result = ESM_IMPORT
      + '(function() {'
      + '%output%' 
      + '}).apply('
      + 'typeof global !== \'undefined\' '
      + '? global : typeof self !== \'undefined\' '
      + '? self : window );'
      + ESM_DIALOG_POLYFILL + ESM_EXPORT
      + `//# sourceMappingURL=${path.basename(sourceMap)}`;
  }
  return result
}


/**
 * Invokes Closure Compiler.
 * @param {!Array<string>} srcs The JS sources to compile.
 * @param {string} out The path to the output JS file.
 * @param {!Object} args Additional arguments to Closure compiler.
 * @return {*} A stream that finishes when compliation finishes.
 */
function compile(srcs, out, args) {
  // Get the compiler arguments, using the defaults if not specified.
  const combinedArgs = Object.assign({}, COMPILER_DEFAULT_ARGS, args);

  return gulp
      .src(srcs)
      .pipe(closureCompiler({
        compilerPath: COMPILER_PATH,
        fileName: path.basename(out),
        compilerFlags: combinedArgs
      }))
      .pipe(gulp.dest(path.dirname(out)));
}

/**
 * Normalizes a locale ID for use in a file name (e.g. en-GB -> en_gb).
 * @param {string} locale
 * @return {string} The normalized locale ID.
 */
function getLocaleForFileName(locale) {
  return locale.toLowerCase().replace(/-/g, '_');
}




/**
 * Repeats a gulp task for all locales.
 * @param {string} taskName The gulp task name to generate. Any $ tokens will be
 *     replaced with the language code (e.g. build-$ becomes build-fr, build-es,
 *     etc.).
 * @param {!Array<string>} dependencies The gulp tasks that each operation
 *     depends on. Any $ tokens will be replaced with the language code.
 * @param {function()} operation The function to execute.
 * @return {!Array<string>} The list of generated task names.
 */
function repeatTaskForAllLocales(taskName, dependencies, operation) {
  return ALL_LOCALES.map((locale) => {
    // Convert build-js-$ to build-js-fr, for example.
    const replaceTokens = (name) => name.replace(/\$/g, locale);
    const localeTaskName = replaceTokens(taskName);
    const localeDependencies = dependencies.map(replaceTokens);
    gulp.task(localeTaskName, gulp.series(
        gulp.parallel(...localeDependencies),
        (cb) => operation(cb, locale)
    ));
    return localeTaskName;
  });
}

/**
 * Builds the core FirebaseUI binary in the given locale.
 * @param {string} locale
 * @return {*} A stream that finishes when compilation finishes.
 */
function buildFirebaseUiJs(locale, id) {
  const outputPath = getTmpJsPath(locale, id)
  const sourceMapName = getSourceMapName(outputPath)
  const flags = getFireBaseCompilationFlags(locale, outputPath, id)
  const sources = getFireBaseSourceFiles(id) 
  return compile(sources, outputPath, flags);
}

/**
 * get firebase compilation flags
 */
function getFireBaseCompilationFlags(
  locale, outputPath, id) {

  const sourceMapName = getSourceMapName(outputPath)
  
  const flags = {
    closure_entry_point: 'firebaseui.auth.exports',
    define: `goog.LOCALE='${locale}'`,
    externs: [
      'node_modules/firebase/externs/firebase-app-externs.js',
      'node_modules/firebase/externs/firebase-auth-externs.js',
      'node_modules/firebase/externs/firebase-client-auth-externs.js'
    ],
    only_closure_dependencies: true,
    output_wrapper: getOutputWrapper(sourceMapName),

    // This is required to support @export annotation to expose external
    // properties.
    export_local_property_definitions: true,
    generate_exports: true,

    // This is required to match XTB IDs to the JS/Soy messages.
    translations_project: 'FirebaseUI'
  };
  if (locale !== DEFAULT_LOCALE) {
    flags.translations_file = `translations/${locale}.xtb`;
  }
  return flags
}

/**
 * firebase source files
 */
function getFireBaseSourceFiles(id) {
  const result = [
    'node_modules/google-closure-templates/javascript/soyutils_usegoog.js',
    'node_modules/google-closure-library/closure/goog/**/*.js',
    'node_modules/google-closure-library/third_party/closure/goog/**/*.js',
    `${getSoyProcessedIntermidiateDirectory(id)}/**/*.js`,
    'javascript/**/*.js'
  ]
  return result
}



/**
 * Concatenates the core FirebaseUI JS with its external dependencies, and
 * cleans up comments and whitespace in the dependencies.
 * @param {string} locale The desired FirebaseUI locale.
 * @param {string} outBaseName The prefix of the output file name.
 * @param {string} outputWrapper A wrapper with which to wrap the output JS.
 * @param {?Array<string>=} dependencies The dependencies to concatenate.
 * @return {*} A stream that ends when compilation finishes.
 */
function concatWithDeps(cb, locale, outBaseName,
  outputWrapper, dependencies = [], id) {
  const localeForFileName = getLocaleForFileName(locale);
  // Get a list of the FirebaseUI JS and its dependencies.
  const srcs = dependencies.concat(getFireBaseSourceFiles(id));

  const outputPaths = getOutputPaths(outBaseName, locale, id)

  const promises = []
  outputPaths.forEach(outputPath => { 
    const sourceMapName = getSourceMapName(outputPath)
    const wrapper = outputWrapper(sourceMapName)
    const flags = Object.assign({}, 
      getFireBaseCompilationFlags(locale, outputPath, id), {
      compilation_level: OPTIMIZATION_LEVEL, 
      output_wrapper: wrapper
    })
     
    const st = compile(srcs, outputPath, flags)
    promises.push(new Promise((resolve, reject) => {
      st.once('end', st => {
        resolve(st)
      })  
      st.once('error', error => {
        connsole.log('error occured')
        reject(error)
      })
    }))
  })
  Promise.allSettled(promises).then(responses => {
    cb()
  })
}

/**
 * source map name
 */
function getSourceMapName(outputPath) {
  return `${outputPath}.map`
}

/**
 *
 */
function getOutputPaths(outBaseName, locale, id) {
  const localeForFileName = getLocaleForFileName(locale);
  if (id == '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  const result = [
    `${DEST_DIR}/${outBaseName}${idStr}__${localeForFileName}.js`
  ];
  if (locale == DEFAULT_LOCALE) {
    result.push(`${DEST_DIR}/${outBaseName}${idStr}.js`)
  }
  return result
}


// Generates the typescript definitions.
gulp.task('build-ts',
  cb => {
    const st = gulp.src(TYPES_FILE).pipe(gulp.dest(`${DEST_DIR}/`))
    st.once('end', st=> {
      cb()
    })
  });

// Generates the externs definitions.
gulp.task('build-externs',
  cb => {
    const st = gulp.src(EXTERNS_FILES).pipe(
      gulp.dest(`${DEST_DIR}/externs/`));
    st.once('end', st => {
      cb()
    })
  });


/**
 * register firebase tasks
 */
function registerTasks(id) {

  let idStr = undefined
  if (id === '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  const soyTaskStr = `build-soy${idStr}`

  // Concatenates and minifies the CSS sources for LTR languages.
  gulp.task(`build-css${idStr}`, (cb) => buildCss(cb, false, id));

  // Concatenates and minifies the CSS sources for RTL languages.
  gulp.task(`build-css-rtl${idStr}`, (cb) => buildCss(cb, true, id));

  // Compiles the Closure templates into JavaScript.
  gulp.task(soyTaskStr, (cb) => {
    closureBuilder.build(getSoyCompileOption(id),
      (erros, warnings, files, results) => {
        cb() 
      });

  });

  const uiDependencies = ['build-externs', 'build-ts', soyTaskStr]

  // Builds the core FirebaseUI JS. Generates the gulp tasks
  // build-firebaseui-js-de, build-firebaseui-js-fr, etc.
  repeatTaskForAllLocales(
      `build-firebaseui-js${idStr}-$`,
      uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'firebaseui', getOutputWrapper, 
        [], id));

  // Bundles the FirebaseUI JS with its dependencies as a NPM module.
  // This builds the NPM module for all languages.
  const buildNpmTasks = repeatTaskForAllLocales(
      `build-npm${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'npm', getNpmModuleWrapper, 
        CJS_DEPS, id));

  // Bundles the FirebaseUI JS with its dependencies as a ESM module.
  // This builds the NPM module for all languages.
  const buildEsmTasks = repeatTaskForAllLocales(
      `build-esm${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'esm', getEsmModuleWrapper,
        [], id));

  // Bundles the FirebaseUI JS with its dependencies for all locales.
  // Generates the gulp tasks build-js-de, build-js-fr, etc.
  const buildJsTasks = repeatTaskForAllLocales(
      `build-js${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'firebaseui', getOutputWrapper,
        CJS_DEPS, id));


  // Builds the final JS file for the default language.
  gulp.task(`build-js${idStr}`,
      gulp.parallel(`build-js${idStr}-${DEFAULT_LOCALE}`));


  // Builds the final JS file for all supported languages.
  gulp.task(`build-all-js${idStr}`, 
      gulp.parallel(...buildJsTasks));

  // Builds the NPM module for the default language.
  gulp.task(`build-npm${idStr}`, 
      gulp.parallel(`build-npm${idStr}-${DEFAULT_LOCALE}`));

  // Builds the ESM module for the default language.
  gulp.task(`build-esm${idStr}`,
      gulp.parallel(`build-esm${idStr}-${DEFAULT_LOCALE}`));

}

registerTasks('') 
registerTasks('1') 

/**
 * Builds the CSS for FirebaseUI.
 * @param {boolean} isRtl Whether to build in right-to-left mode.
 * @return {*} A stream that finishes when compilation finishes.
 */
function buildCss(cb, isRtl, id) {
  const mdlSrcs = gulp.src('stylesheet-common/mdl.scss')
      .pipe(sass.sync().on('error', sass.logError))
      .pipe(cssInlineImages({
        webRoot: 'node_modules/material-design-lite/src',
      }));
  const dialogPolyfillSrcs = gulp.src(
      'node_modules/dialog-polyfill/dialog-polyfill.css');
  let idStr = undefined
  if (id == '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  let firebaseSrcs = gulp.src(`stylesheet${idStr}/*.css`);

  // Flip left/right, ltr/rtl for RTL languages.
  if (isRtl) {
    firebaseSrcs = firebaseSrcs.pipe(flip.gulp());
  }

  const outFile = isRtl ?
    `firebaseui${idStr}-rtl.css` :
    `firebaseui${idStr}.css`;
  const st = streamqueue({objectMode: true},
      mdlSrcs, dialogPolyfillSrcs, firebaseSrcs)
      .pipe(concatCSS(outFile))
      .pipe(cleanCSS())
      .pipe(gulp.dest(DEST_DIR));

  st.once('end', st=> cb()) 
}



// Creates a webserver that serves all files from the root of the package.
gulp.task('serve', () => {
  connect.server({
    port: 4000
  });
});

// Deletes intermediate files.
gulp.task('clean', () => fse.remove(TMP_ROOT_DIR));

// Executes the basic tasks for the default language.
gulp.task('default', gulp.series(
    'build-js', 'build-js-1',
    'build-npm', 'build-esm', 'build-css', 'build-css-rtl',
    'build-npm-1', 'build-esm-1', 'build-css-1', 'build-css-rtl-1',
));

// Builds everything (JS for all languages, both LTR and RTL CSS).
gulp.task('build-all', gulp.series(
    'build-all-js-1',
    'build-npm', 'build-esm', 'build-css', 'build-css-rtl',
    'build-npm-1', 'build-esm-1', 'build-css-1', 'build-css-rtl-1'
));
