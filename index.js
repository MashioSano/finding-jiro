require('dotenv').config()
const fs = require('fs')
const { Client } = require('@googlemaps/google-maps-services-js')
const client = new Client({})
const inquirer = require('inquirer')

async function setkey () {
  const key = await inquirer
    .prompt([
      {
        name: 'key',
        message: 'Plase Enter your Google Map API KEY.'
      }
    ])
    .then(answers => {
      return answers.key
    })
  fs.writeFileSync('.env', `GOOGLE_MAP_API_KEY = ${key}`, { flag: 'a' })
  require('dotenv').config()
}

function geocode (address, key) {
  return client
    .geocode({
      params: {
        address: address,
        key: String(key),
        language: 'ja'
      },
      timeout: 1000
    })
    .then((res) => {
      return res.data.results[0].geometry.location
    })
}

function serachShop (latlng, key) {
  return client
    .placesNearby({
      params: {
        location: latlng,
        key: String(key),
        type: ['restaurant'],
        keyword: 'ラーメン二郎',
        language: 'ja',
        rankby: 'distance'
      },
      timeout: 10000
    }).then((r) => {
      return r.data.results
    })
    .catch((e) => {
      console.log(e)
    })
}

function sortByRating (places) {
  places.sort(function (a, b) {
    if (a.rating > b.rating) return -1
    if (a.rating < b.rating) return 1
    return 0
  })
  return places
}

function extractLatlngFromPlaces (places) {
  const latlngArray = []
  places.forEach(p => {
    latlngArray.push(p.geometry.location)
  })
  return latlngArray
}

function measureDistance (origin, destinations, key) {
  return client
    .distancematrix({
      params: {
        key: key,
        origins: [origin],
        destinations: destinations,
        mode: 'walking',
        language: 'ja'
      }
    })
}

function addDistanceToPlace (places, distances) {
  places.forEach((place, index) => {
    const distance = distances[index].distance.text
    place.distance = distance
  })
  return places
}

function selectOption () {
  return inquirer
    .prompt([
      {
        name: 'address',
        message: 'Enter address.'
      },
      {
        type: 'list',
        name: 'jiroonly',
        message: 'Do you want to include Jiro type ramen in your search?',
        choices: ['Yes', 'No']
      },
      {
        type: 'list',
        name: 'sort',
        message: 'Choose a sort order.',
        choices: ['rating', 'distance']
      }
    ])
}

function formatter (places) {
  places.forEach(place => {
    console.log('------------------------------------------------------------')
    console.log(place.name)
    console.log('Rating:', '🧄'.repeat((Math.floor(place.rating))), place.rating)
    console.log('Address:', place.vicinity)
    console.log('Distance:', place.distance)
  })
}

function extractJiro (places) {
  const jiroArray = []
  places.forEach(place => {
    if (place.name.indexOf('ラーメン二郎') === 0) { jiroArray.push(place) }
  })
  return jiroArray
}

async function main () {
  if (process.env.GOOGLE_MAP_API_KEY === undefined) {
    await setkey()
  }
  const key = process.env.GOOGLE_MAP_API_KEY

  const userInput = await selectOption()

  const origin = await geocode(userInput.address, key)

  let places = await serachShop(origin, key)

  if (userInput.jiroonly === 'No') { places = extractJiro(places) }

  if (places.length === 0) {
    console.log('Not Found. Please enter another address')
    return
  }
  const destinations = extractLatlngFromPlaces(places)
  const distances = await (await measureDistance(origin, destinations, key)).data.rows[0].elements

  places = addDistanceToPlace(places, distances)
  if (userInput.sort === 'rating') {
    formatter(sortByRating(places))
  } else {
    formatter((places))
  }
}

main()
