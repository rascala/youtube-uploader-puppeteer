const fs = require("fs")
const child_process = require('child_process')

const HomesDataQuery = ({county, nhood, city, state}) => `
{
  homesSearch(variables: {${county ? 'counties:["'+county+'"],' : ''} ${nhood ? 'geoNeighborhoods:["'+nhood+'"],' : ''} ${city ? 'cities:["'+city+'"],' : ''} ${state ? 'states:["'+state+'"],' : ''}, statuses:["FOR_SALE"]}, sortFields:SCORE, limit: 50) {
    homes{
      id
      homeId
      status
      homeType
      street
      city
      state
      zipcode
      status
      listingPrice
      notes
    }
  }
}
`

const encodedHomesDataQuery = (params) => encodeURIComponent(HomesDataQuery(params)).replace(/\(/g, '\\\(').replace(/\)/g, '\\\)')
const HomesDataQuery_COMMAND = (params) => `curl https://zerodown.com/graphql\\\?query=${encodedHomesDataQuery(params)}`


const HomeDataQuery = (home_id) => `
{
  homes(ids:[${home_id}]) {
    id
    homeId
    status
    homeType
    street
    city
    state
    zipcode
    status
    listingPrice
    notes
  }
}
`

const encodedHomeDataQuery = (home_id) => encodeURIComponent(HomeDataQuery(home_id))
    .replace('(', '\\\(')
    .replace(')', '\\\)')
const HomeDataQuery_COMMAND = (home_id) => `curl https://zerodown.com/graphql\\\?query=${encodedHomeDataQuery(home_id)}`

function runCmd(cmd) {
  var resp = child_process.execSync(cmd, {maxBuffer: 4 * 1024 * 1024})
  var result = JSON.parse(resp.toString('UTF8'))
  return result
}

async function getHomes(params) {
  console.log('-- INFO - [CURL] - starting curl to fetch latest homes ' + JSON.stringify(params))
  const result = runCmd(HomesDataQuery_COMMAND(params))
  console.log('-- INFO - [CURL] - done fetching')
  console.log(result)
  return result.data.homesSearch.homes
}

async function getHomeData(home_id) {
  console.log('-- INFO - [CURL] - starting curl to fetch home data')
  const result = runCmd(HomeDataQuery_COMMAND(home_id))
  console.log('-- INFO - [CURL] - done fetching')
  return result.data.homes[0]
}

module.exports = { 
  getHomes,
  getHomeData,
}

