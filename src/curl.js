const fs = require("fs")
const child_process = require('child_process')

const CountyHomesDataQuery = (county) => `
{
  homesSearch(variables: {counties:["${county}"], statuses:["FOR_SALE"]}, sortFields:SCORE, limit: 2000) {
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

const encodedCountyHomesDataQuery = (county) => encodeURIComponent(CountyHomesDataQuery(county))
    .replace('(', '\\\(')
    .replace(')', '\\\)')
const CountyHomesDataQuery_COMMAND = (county) => `curl https://zerodown.com/graphql\\\?query=${encodedCountyHomesDataQuery(county)}`


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

async function getCountyHomes(county) {
  console.log('-- INFO - [CURL] - starting curl to fetch latest county homes')
  const result = runCmd(CountyHomesDataQuery_COMMAND(county))
  console.log('-- INFO - [CURL] - done fetching')
  return result.data.homesSearch.homes
}

async function getHomeData(home_id) {
  console.log('-- INFO - [CURL] - starting curl to fetch home data')
  const result = runCmd(HomeDataQuery_COMMAND(home_id))
  console.log('-- INFO - [CURL] - done fetching')
  return result.data.homes[0]
}

module.exports = { 
  getCountyHomes,
  getHomeData,
}
