import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json'

const banner = `/**
 * Nitro - ${pkg.description}
 *
 * @author Dmitry Dudin <dima@nuware.ru>
 * @version ${pkg.version}
 * @license MIT
 */`

const external = ['@nuware/functions', '@nuware/emitter', '@nuware/id']

export default [{
  input: 'src/index.js',
  external,
  output: {
    file: pkg.module,
    format: 'esm',
    banner
  }
}, {
  input: 'src/index.js',
  external,
  output: {
    file: pkg.main,
    format: 'cjs',
    banner
  }
}, {
  input: 'src/index.js',
  output: {
    file: pkg.browser,
    format: 'umd',
    name: 'nuware.Nitro',
    banner
  },
  plugins: [
    resolve(),
    commonjs()
  ]
}, {
  input: 'src/index.js',
  output: {
    file: pkg.minimized,
    format: 'umd',
    name: 'nuware.Nitro'
  },
  plugins: [
    resolve(),
    commonjs(),
    terser()
  ]
}]
