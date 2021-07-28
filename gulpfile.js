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
const child_proc = require('child_process')

// The optimization level for the JS compiler.
// Valid levels: WHITESPACE_ONLY, SIMPLE_OPTIMIZATIONS, ADVANCED_OPTIMIZATIONS.
// This can be passed in as a flag:
// $ gulp --compilation_level=WHITESPACE_ONLY
// const OPTIMIZATION_LEVEL = util.env.compilation_level ||
//   'ADVANCED_OPTIMIZATIONS';
// const OPTIMIZATION_LEVEL = util.env.compilation_level ||
//    'WHITESPACE_ONLY';
const OPTIMIZATION_LEVEL = util.env.compilation_level ||
    'SIMPLE_OPTIMIZATIONS';



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
].concat(MDL_COMPONENTS.map(component => 
    `node_modules/material-design-lite/src/${component}.js`));

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
const ALL_LOCALES = [
    'en',
    'ar-XB'/*, 'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el',
    'en-GB', 'en-XA', 'es-419', 'es', 'fa', 'fi', 'fil', 'fr', 'hi', 'hr', 'hu',
    'id', 'it', 'iw', 'ja', 'ko', 'lt', 'lv', 'nl', 'no', 'pl', 'pt-PT',
    'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'th', 'tr', 'uk', 'vi',
    'zh-CN', 'zh-TW'*/];


// Default arguments to pass into Closure Compiler.
const COMPILER_DEFAULT_ARGS = {
  compilation_level: OPTIMIZATION_LEVEL,
  language_out: 'ES5'
};

// The typescript definitions file path.
const TYPES_FILE = './types/index.d.ts';

// The externs directory files.
const EXTERNS_FILES = './externs/*.js';


function getSoyDirectory(id) {
  let idStr = undefined
  if (id == '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  return `soy${idStr}`
}

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
      `${getSoyDirectory(id)}/*.soy`
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
function getOutputWrapper(
  output,
  sourceMap) {
  let wrapper = undefined
  let sourceMappingUrl = undefined
  if (sourceMap) {
    sourceMappingUrl = `//# sourceMappingURL=${path.basename(sourceMap)}`
  } else {
    sourceMappingUrl = ''
  }
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY'){
    wrapper = `%output%${sourceMappingUrl}`
  } else {
    wrapper = '(function() { %output% }).apply('
      + 'typeof global !== \'undefined\' '
      + '? global : typeof self !== \'undefined\' '
      + '? self : window );'
      + `${sourceMappingUrl}`;
  }

  const result = {
    wrapper,
    sourceMap: createSourceMapGenerator(wrapper, output, sourceMap) 
  } 

  return result
}


/**
 * create source map
 */
function createSourceMapGenerator(
  wrapper,
  outputFileName,
  sourceMap) {
  const result = function(st) {
    const EventEmitter = require('events')
    const result = new EventEmitter()
    const emitter = result
    st.on('end', function() {
      const outputLoc = wrapper.indexOf('%output%')
      if (outputLoc > 0 && sourceMap) {

        const data = fse.readFileSync(sourceMap)
        if (data) {
          const version = 3
          const file = outputFileName 
          const mapContents = `{
  "version": ${version},
  "file": "${path.basename(file)}",
  "sections": [
    {
      "offset": { "line": 0, "column": ${outputLoc} }, 
      "map": ${data}
    }
  ] 
}`
          fse.writeFile(sourceMap, mapContents, (err)=> {
            if (err) {
              emitter.emit('error', err) 
            } else {
              emitter.emit('end')
            }
          }) 
        } else {
          emitter.emit('end')
        }
      } else {
        emitter.emit('end')
      }
    })
    return result
  } 
  return result
}



// Adds the cjs module requirement and exports firebaseui.
function getNpmModuleWrapper(output, sourceMap) {
  let wrapper = undefined
  let sourceMappingUrl = undefined
  if (sourceMap) {
    sourceMappingUrl = `//# sourceMappingURL=${sourceMap}`
  } else {
    sourceMappingUrl = ''
  }
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY') {
    wrapper = 'var firebase=require(\'firebase/app\');'
      + 'require(\'firebase/auth\');'
      + DEFAULT_IMPORT_FIX
      + '%output%'
      + DIALOG_POLYFILL
      + 'module.exports=firebaseui;'
      + `${sourceMappingUrl}`;

  } else { 
    wrapper = '(function() { var firebase=require(\'firebase/app\');'
      + 'require(\'firebase/auth\');'
      + DEFAULT_IMPORT_FIX
      + '%output% '
      + DIALOG_POLYFILL
      + '})();'
      + 'module.exports=firebaseui;'
      + `${sourceMappingUrl}`;
  }
  const result = {
    wrapper,
    sourceMap: createSourceMapGenerator(wrapper, output, sourceMap) 
  } 
  return result
}

// Adds the module requirement and exports firebaseui.
function getEsmModuleWrapper(output, sourceMap) {
  let wrapper = undefined
  let sourceMappingUrl = undefined
  if (sourceMap) {
    sourceMappingUrl = `//# sourceMappingURL=${sourceMap}`
  } else {
    sourceMappingUrl = ''
  }
  if (OPTIMIZATION_LEVEL === 'WHITESPACE_ONLY') {
    wrapper = ESM_IMPORT
      + '%output%'
      + ESM_DIALOG_POLYFILL
      + ESM_EXPOR
      + `${sourceMappingUrl}`
  } else {
    wrapper = ESM_IMPORT
      + '(function() {'
      + '%output%' 
      + '}).apply('
      + 'typeof global !== \'undefined\' '
      + '? global : typeof self !== \'undefined\' '
      + '? self : window );'
      + ESM_DIALOG_POLYFILL + ESM_EXPORT
      + `${sourceMappingUrl}`;
  }
  const result = {
    wrapper,
    sourceMap: createSourceMapGenerator(wrapper, output, sourceMap) 
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
function compile(srcs, out, sourceMapName, args) {
  // Get the compiler arguments, using the defaults if not specified.
  const combinedArgs = Object.assign({}, COMPILER_DEFAULT_ARGS, args);
  const fs = require('fs')

  let doCompile = false
  if (fs.existsSync(out)) {
    const outFd = fs.openSync(out)
    const outStat = fs.fstatSync(outFd)
    let havingNewFiles = false

    const sourceFiles = glob(srcs)
    for (let idx = 0; idx < sourceFiles.length; idx++) {
      let elem = sourceFiles[idx]
      const elemFd = fs.openSync(elem)
      const elemStat = fs.fstatSync(elemFd) 
      if (elemStat.isFile()) {
        havingNewFiles = elemStat.mtimeMs - outStat.mtimeMs > 0
      }
      fs.closeSync(elemFd)
      if (havingNewFiles) {
        break
      }
    }
    fs.closeSync(outFd) 
    doCompile = havingNewFiles
  } else {
    doCompile = true
  }

  let result = undefined
  if (doCompile) {
    if (fs.existsSync(sourceMapName)) {
      fs.unlinkSync(sourceMapName)
    }
    result = gulp.src(srcs)
      .pipe(closureCompiler({
        compilerPath: COMPILER_PATH,
        fileName: path.basename(out),
        compilerFlags: combinedArgs
      }))
      .pipe(gulp.dest(path.dirname(out)));
  } else {
    const EventEmitter = require('events')
    result = new EventEmitter()
    setTimeout(() => {
      result.emit('end')
    }) 
  }
  return result
}


function compileSoyFiles(cb, id) {

  const compileOption = getSoyCompileOption(id)

  const fs = require('fs')
  let doCompile = false

  for (let idx = 0; idx < compileOption.srcs.length; idx++) {
    const source = compileOption.srcs[idx]
    let srcPathInfo = path.parse(source)
    let output = path.join(compileOption.out,
      getSoyDirectory(id), `${srcPathInfo['name']}.soy.js`) 
    if (fs.existsSync(output)) {
      const srcFd = fs.openSync(source)
      const srcStat = fs.fstatSync(srcFd) 
      const outputFd = fs.openSync(output)
      const outputStat = fs.fstatSync(outputFd) 
      if (outputStat.isFile()) {
        doCompile = srcStat.mtimeMs - outputStat.mtimeMs > 0
      }
      fs.closeSync(outputFd)
      fs.closeSync(srcFd)
    } else {
      doCompile = true
    }
    if (doCompile) {
      break
    }
  }

  if (doCompile) {
    closureBuilder.build(compileOption,
      (erros, warnings, files, results) => {
        cb() 
      })
  } else {
    cb()
  }
}

/**
 * Normalizes a locale ID for use in a file name (e.g. en-GB -> en_gb).
 * @param {string} locale
 * @return {string} The normalized locale ID.
 */
function getLocaleForFileName(locale) {
  return locale.toLowerCase().replace(/-/g, '_');
}

function mergeXtb(cb, locale) {
  const transPath = path.join('./', 'translations', `${locale}.xtb`) 
  const xtbgenPath = path.join('./', 'tools', 'XtbGeneratorRunner')
  const outputPath = path.join('./', 'translations',  `${locale}.xtb`)

  let jsFiles = [] 
  glob([
    './javascript/**/*.js',
    './out/**/*.js'
  ]).forEach(elem => {
    if (!elem.endsWith('_test.js')) {
      jsFiles.push(elem)
    }
  })
  jsFiles = jsFiles.map(elem => `--js '${elem}'`) 

  const commands = [
    `"${xtbgenPath}"`,
    `--lang ${locale}`,
    `--translations_file ${transPath}`,
    `--xtb_output_file ${outputPath}`,
    ...jsFiles
  ]

  const cmdStr = commands.join(' ')
  child_proc.exec(cmdStr, (err, stdout, stderr) => {
    
    if (stderr.length > 0) {
      console.log(stderr)
    }
    if (stdout.length > 0) {
      console.log(stdout)
    }

    cb()
  })
}

const taskNames = repeatTaskForAllLocales('merge-xtb-$', [], mergeXtb) 

gulp.task('merge-xtb', gulp.parallel(taskNames))

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
    if (dependencies.length) {
      const localeDependencies = dependencies.map(replaceTokens);
      gulp.task(localeTaskName, gulp.series(
          gulp.parallel(...localeDependencies),
          (cb) => operation(cb, locale)
      ));
    } else {
      gulp.task(localeTaskName, (cb) => operation(cb, locale))
    }
    return localeTaskName;
  });
}

/**
 * get firebase compilation flags
 */
function getFireBaseCompilationFlags(
  locale, outputPath, id) {

  
  const flags = {
    closure_entry_point: 'firebaseui.auth.exports',
    define: `goog.LOCALE='${locale}'`,
    externs: getFirebaseCompilerExtern(),
    only_closure_dependencies: true,
    // This is required to support @export annotation to expose external
    // properties.
    export_local_property_definitions: true,
    generate_exports: true,

    // This is required to match XTB IDs to the JS/Soy messages.
    translations_project: 'FirebaseUI'
  };

  if (OPTIMIZATION_LEVEL == 'WHITESPACE_ONLY') {
    flags.force_inject_library = 'base'
  }

  if (locale !== DEFAULT_LOCALE) {
    flags.translations_file = `translations/${locale}.xtb`;
  }
  return flags
}


/**
 * firebase compiler extern option
 */
function getFirebaseCompilerExtern() {
  return [
    'node_modules/firebase/externs/firebase-app-externs.js',
    'node_modules/firebase/externs/firebase-auth-externs.js',
    'node_modules/firebase/externs/firebase-client-auth-externs.js',
    'thirdparty/extern/popper.js'
  ]
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
  outputWrapper, dependencies = [], id, compilerOption) {
  const localeForFileName = getLocaleForFileName(locale);
  // Get a list of the FirebaseUI JS and its dependencies.
  const srcs = dependencies.concat(getFireBaseSourceFiles(id));

  const outputPaths = getOutputPaths(outBaseName, locale, id)

  const promises = []
  outputPaths.forEach(outputPath => { 
    const sourceMapName = getSourceMapName(outputPath)
    const wrapperSetting = outputWrapper(outputPath, sourceMapName)
    const flags = Object.assign({}, 
      getFireBaseCompilationFlags(locale, outputPath, id), {
      compilation_level: OPTIMIZATION_LEVEL, 
      output_wrapper: wrapperSetting.wrapper,
      create_source_map: sourceMapName,
      source_map_include_content: true,
      process_common_js_modules: true
    })
   
    if (compilerOption) {
      Object.assign(flags, compilerOption)
    }
     
    const st = compile(srcs, outputPath, sourceMapName, flags)
    const srcMapEmitter = wrapperSetting.sourceMap(st) 
    promises.push(new Promise((resolve, reject) => {
      srcMapEmitter.once('end', () => {
        resolve()
      })  
      srcMapEmitter.once('error', error => {
        console.log(error)
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
function registerTasks(cssOption, id, compilerOption) {

  let idStr = undefined
  if (id === '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }
  const soyTaskStr = `build-soy${idStr}`

  // Concatenates and minifies the CSS sources for LTR languages.
  gulp.task(`build-css${idStr}`, (cb) => buildCss(cb, false, cssOption, id));

  // Concatenates and minifies the CSS sources for RTL languages.
  gulp.task(`build-css-rtl${idStr}`, (cb) => buildCss(cb, true, cssOption, id));

  // Compiles the Closure templates into JavaScript.
  gulp.task(soyTaskStr, cb => compileSoyFiles(cb, id))


  const uiDependencies = [soyTaskStr]

  // Builds the core FirebaseUI JS. Generates the gulp tasks
  // build-firebaseui-js-de, build-firebaseui-js-fr, etc.
  repeatTaskForAllLocales(
      `build-firebaseui-js${idStr}-$`,
      uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'firebaseui', getOutputWrapper, 
        [], id, compilerOption));

  // Bundles the FirebaseUI JS with its dependencies as a NPM module.
  // This builds the NPM module for all languages.
  const buildNpmTasks = repeatTaskForAllLocales(
      `build-npm${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'npm', getNpmModuleWrapper, 
        CJS_DEPS, id, compilerOption));

  // Bundles the FirebaseUI JS with its dependencies as a ESM module.
  // This builds the NPM module for all languages.
  const buildEsmTasks = repeatTaskForAllLocales(
      `build-esm${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'esm', getEsmModuleWrapper,
        [], id, compilerOption));

  // Bundles the FirebaseUI JS with its dependencies for all locales.
  // Generates the gulp tasks build-js-de, build-js-fr, etc.
  const buildJsTasks = repeatTaskForAllLocales(
      `build-js${idStr}-$`, uiDependencies,
      (cb, locale) => concatWithDeps(
        cb, locale, 'firebaseui', getOutputWrapper,
        CJS_DEPS, id, compilerOption));




  // Builds the final JS file for all supported languages.
  gulp.task(`build-all-js${idStr}`, 
      gulp.parallel(...buildJsTasks));

  gulp.task(`build-all-series-js${idStr}`, 
      gulp.series(...buildJsTasks));


  gulp.task(`build-all-npm-js${idStr}`,
      gulp.parallel(buildNpmTasks))

  gulp.task(`build-all-series-npm-js${idStr}`,
      gulp.series(buildNpmTasks))


  gulp.task(`build-all-esm-js${idStr}`,
      gulp.parallel(buildEsmTasks))

  gulp.task(`build-all-series-esm-js${idStr}`,
      gulp.series(buildEsmTasks))



  // Builds the final JS file for the default language.
  gulp.task(`build-js${idStr}`,
      gulp.parallel(`build-js${idStr}-${DEFAULT_LOCALE}`));

  // Builds the NPM module for the default language.
  gulp.task(`build-npm${idStr}`, 
      gulp.parallel(`build-npm${idStr}-${DEFAULT_LOCALE}`));

  // Builds the ESM module for the default language.
  gulp.task(`build-esm${idStr}`,
      gulp.parallel(`build-esm${idStr}-${DEFAULT_LOCALE}`));

}

registerTasks({
    useMdl: true
  }, '') 
registerTasks({
    useMdl: false
  }, '1') 

/**
 * get compiler option 
 */
function getTask1CompilerOption() {
}


/**
 * Builds the CSS for FirebaseUI.
 * @param {boolean} isRtl Whether to build in right-to-left mode.
 * @return {*} A stream that finishes when compilation finishes.
 */
function buildCss(cb, isRtl, cssOption, id) {
  const mdlSrcs = []
  if (cssOption.useMdl) {
    mdlSrcs.push(gulp.src('stylesheet-common/mdl.scss')
      .pipe(
        sass.sync({
          includePaths: [
            './node_modules' 
          ]
        }).on('error', sass.logError))
      .pipe(cssInlineImages({
        webRoot: 'node_modules/material-design-lite/src',
      })));
  }
  const dialogPolyfillSrcs = gulp.src(
      'node_modules/dialog-polyfill/dialog-polyfill.css');
  let idStr = undefined
  if (id == '') {
    idStr = id
  } else {
    idStr = `-${id}`
  }

  let firebaseSrcs = [
    gulp.src(`stylesheet${idStr}/scss/*.scss`).pipe(
      sass.sync({
        includePaths: [
          './node_modules'
        ]
      }).on('error', sass.logError)),
    gulp.src(`stylesheet${idStr}/css/*.css`)
  ];

  // Flip left/right, ltr/rtl for RTL languages.
  if (isRtl) {
    for (let idx = 0; idx < firebaseSrcs.length; idx++) {
      firebaseSrcs[idx] = firebaseSrcs[idx].pipe(flip.gulp());
    }
  }

  const sources = []
  sources.push(...mdlSrcs)
  sources.push(dialogPolyfillSrcs)
  sources.push(...firebaseSrcs)

  const outFile = isRtl ?
    `firebaseui${idStr}-rtl.css` :
    `firebaseui${idStr}.css`;
  const st = streamqueue({objectMode: true},
      ...sources)
      .pipe(concatCSS(outFile))
      .pipe(cleanCSS({format: 'beautify'}))
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
gulp.task('default',
    gulp.parallel(
      gulp.series(
        gulp.parallel('build-externs', 'build-ts'), 
        gulp.parallel('build-js', 'build-js-1'),
        gulp.parallel('build-npm', 'build-npm-1'),
        gulp.parallel('build-esm', 'build-esm-1')), 
      'build-css', 'build-css-rtl', 'build-css-1', 'build-css-rtl-1'));

// Builds everything (JS for all languages, both LTR and RTL CSS).
gulp.task('build-all',
    gulp.parallel(
      gulp.series(
        gulp.parallel('build-externs', 'build-ts'), 
        gulp.parallel('build-all-js', 'build-all-js-1'),
        gulp.parallel('build-all-npm-js', 'build-all-npm-js-1'),
        gulp.parallel('build-all-esm-js', 'build-all-esm-js-1'),
        gulp.parallel('build-js', 'build-npm', 'build-esm'),
        gulp.parallel('build-js-1', 'build-npm-1', 'build-esm-1')),
      'build-css', 'build-css-rtl', 'build-css-1', 'build-css-rtl-1'));

gulp.task('build-demo', 
  gulp.parallel(
    gulp.series(
      gulp.parallel('build-externs', 'build-ts'), 
      gulp.parallel('build-js', 'build-js-1')),
    'build-css', 'build-css-1', 'build-css-rtl', 'build-css-rtl-1'))

gulp.task('build-demo-css', 
  gulp.parallel(
    'build-css', 'build-css-1', 'build-css-rtl', 'build-css-rtl-1'))

gulp.task('build-all-series',
  gulp.series(
    'build-externs', 'build-ts', 
    'build-all-series-js', 'build-all-series-js-1',
    'build-all-series-npm-js', 'build-all-series-npm-js-1',
    'build-all-series-esm-js', 'build-all-series-esm-js-1',
    'build-js', 'build-npm', 'build-esm',
    'build-js-1', 'build-npm-1', 'build-esm-1',
    'build-css', 'build-css-rtl',
    'build-css-1', 'build-css-rtl-1'));



// vi: se ts=2 sw=2 et:
