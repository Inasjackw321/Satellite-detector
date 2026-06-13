/**
 * Warsummary maps — free, local AI image enhancer.
 *
 * Upscales / sharpens a JPEG buffer with UpscalerJS (ESRGAN, TensorFlow.js) —
 * no API key, no account. The heavy deps are OPTIONAL: if they aren't installed
 * (or anything fails), this returns the original buffer untouched so the imagery
 * pipeline never breaks. Disable entirely with AI_ENHANCE=0.
 */
let _tf = null;
let _upscaler = null;
let _disabled = null;

async function getUpscaler() {
  if (_upscaler) return _upscaler;
  if (_disabled) return null;
  try {
    _tf = (await import('@tensorflow/tfjs-node')).default;
    const Upscaler = (await import('upscaler/node')).default;
    const model = (await import('@upscalerjs/esrgan-slim')).default;
    _upscaler = new Upscaler({ model });
    return _upscaler;
  } catch (e) {
    _disabled = e.message;
    return null;
  }
}

/**
 * @param {Buffer} buffer JPEG bytes
 * @returns {Promise<{buffer:Buffer, enhanced:boolean, reason?:string}>}
 */
export async function aiEnhance(buffer) {
  const up = await getUpscaler();
  if (!up) return { buffer, enhanced: false, reason: _disabled || 'disabled' };

  let input = null;
  let output = null;
  try {
    input = _tf.node.decodeImage(buffer, 3);
    output = await up.upscale(input, { output: 'tensor', patchSize: 64, padding: 2 });
    const int8 = _tf.cast(output, 'int32');
    const jpeg = await _tf.node.encodeJpeg(int8, 'rgb', 90);
    int8.dispose();
    return { buffer: Buffer.from(jpeg), enhanced: true };
  } catch (e) {
    return { buffer, enhanced: false, reason: e.message };
  } finally {
    if (input) input.dispose();
    if (output) output.dispose();
  }
}

export function enhancerStatus() {
  return _disabled ? `unavailable (${_disabled})` : 'ready';
}
