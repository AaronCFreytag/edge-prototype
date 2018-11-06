const fs = require('fs');
const getPixels = require('get-pixels');
const savePixels = require('save-pixels');
const ndarray = require('ndarray');
const _ = require('lodash');

// Canny edge detection adapted from https://en.wikipedia.org/wiki/Canny_edge_detector

let gaussSigma = 1.9;
let gaussSize = 6;

const makeGaussian = (sigma, size) => {
    let k = size;
    let avg = 0;
    let filter = _.times(2 * k + 1, (y) => {
        let i = y + 1;
        return _.times(2 * k + 1, (x) => {
            let j = x + 1;
            let val = 1 / (2 * Math.PI * sigma * sigma)
                * Math.exp(-((i - k) * (i - k) + (j - k) * (j - k))
                    / (2 * sigma * sigma));
            avg += val / ((2 * k + 1) * (2 * k + 1));
            return val;
        });
    });
    return _.map(filter, (col) => {
        return _.map(col, (data) => {
            return data / avg / ((2 * k + 1) * (2 * k + 1));
        });
    });
}

let gaussFilter = makeGaussian(gaussSigma, gaussSize);

const getPixel = (image, x, y, color) => {
    if (x < 0) {
        x = 0;
    }
    else if (x >= image.shape[0]) {
        x = image.shape[0] - 1;
    }
    if (y < 0) {
        y = 0;
    }
    else if (y >= image.shape[1]) {
        y = image.shape[1] - 1;
    }

    return image.get(x, y, color);
}

const blur = (data) => {
    return convolve(data, gaussFilter);
};

const edge = (image) => {
    let hKernel = [
        [+1, 0, -1],
        [+2, 0, -2],
        [+1, 0, -1]
    ];
    let vKernel = [
        [+1, +2, +1],
        [0, 0, 0],
        [-1, -2, -1]
    ];
    let hImage = convolve(image, hKernel);
    let vImage = convolve(image, vKernel);
    let newArr = ndarray(cloneEmpty(image.data), image.shape);
    let width = image.shape[0];
    let height = image.shape[1];
    let channels = image.shape[2];
    let highest = 0;
    _.each(hImage.data, (pix, ind) => {
        let x = Math.floor(ind / (height * channels));
        let y = Math.floor(ind / channels) % height;
        let channel = ind % channels;
        if (channel == 3) {
            newArr.set(x, y, 3, 255);
            return;
        }
        let pix2 = vImage.get(x, y, channel);
        let val = Math.sqrt(pix * pix + pix2 * pix2);
        if (highest < val) {
            highest = val;
        }
        newArr.set(x, y, channel, val);
    });

    // Scale value accordingly
    _.each(newArr.data, (val, ind) => {
        let x = Math.floor(ind / (height * channels));
        let y = Math.floor(ind / channels) % height;
        let channel = ind % channels;
        if (channel != 3) {
            newArr.set(x, y, channel, val * 255 / highest);
        }
    })
    return newArr;
}

const writeResult = (data) => {
    console.log("Writing file...");
    let stream = fs.createWriteStream("result.png");
    data.pipe(stream)
    stream.on('finish', (src) => {
        stream.end();
        console.log("Done writing");
    });
}

const cloneEmpty = (arr) => {
    return _.map(arr, () => 0);
}

const greyscale = (image) => {
    let newArr = ndarray(cloneEmpty(image.data), image.shape);
    let width = image.shape[0];
    let height = image.shape[1];
    let channels = image.shape[2];
    _.each(image.data.slice(0, width * height), (pix, ind) => {
        let y = Math.floor(ind / width);
        let x = ind % width;
        let val = _.reduce(_.times(channels - 1, (channel) => {
            return image.get(x, y, channel) / (channels - 1);
        }), (x, y) => x + y, 0);
        _.times(channels - 1, (channel) => {
            newArr.set(x, y, channel, val);
        })
        newArr.set(x, y, channels - 1, 255);
    });
    return newArr;
}

const convolve = (image, filter) => {
    let newArr = ndarray(cloneEmpty(image.data), image.shape);
    let width = image.shape[0];
    let height = image.shape[1];
    let channels = image.shape[2];
    let mid = Math.floor(filter.length / 2) + 1;
    _.each(image.data, (pix, ind) => {
        let x = Math.floor(ind / (height * channels));
        let y = Math.floor(ind / channels) % height;
        let channel = ind % channels;
        let val = _.reduce(filter, (acc, arr, row) => {
            return acc + _.reduce(arr, (subacc, val, col) => {
                return subacc + val * getPixel(image, x + col - mid, y + row - mid, channel);
            }, 0);
        }, 0);
        newArr.set(x, y, channel, _.round(val));
    });
    return newArr;
}

const onError = (err) => {
    if (err) throw err;
}

getPixels("test.png", (err, imageData) => {
    if (err) onError(err);
    imageData = greyscale(imageData);
    imageData = blur(imageData);
    imageData = edge(imageData);
    let img = savePixels(imageData, "png");
    writeResult(img);

});