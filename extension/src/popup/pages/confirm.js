import React from 'react'
import querystring from 'query-string'
import to from 'await-to-js'
import browser from 'webextension-polyfill'

import FormatAsset from '../components/formatAsset'
import { HEARTBEAT_INTERVAL } from '../../constants'

const getQuery = () => {
  const href = window.location.href
  const search = href.substring(href.indexOf('?'), href.length)
  return querystring.parse(search)
}

const TransferItem = (props) => {
  const { title, render } = props
  let value = props.value
  if (!value) return null
  if (typeof render === 'function') value = render(value)
  return (
    <div>
      <div className="td-key">{title}</div>
      <div className="break-all">{value}</div>
    </div>
  )
}

const DisplayArgs = ({ args, description }) => {
  return args.map((arg) => {
    let des = description[arg.name]
    let name = arg.name
    let value = arg.value
    if (des) {
      if (des.name) name = `${name} (${des.name})`
      if (des.value) value = `(${des.value}) ${value}`
    }
    return (
      <div key={arg.name} className="sc-args-container">
        <div className="sc-args-key">{name}</div>
        <div className="sc-args-value">{value}</div>
      </div>
    )
  })
}

const startHeartbeat = (transferStateId) => {
  setInterval(async () => {
    const [err, res] = await to(browser.runtime.sendMessage({ action: 'heartbeat', args: { id: transferStateId } }))
    if (err) return console.log(err)
  }, HEARTBEAT_INTERVAL)
}

export default () => {
  const query = getQuery()

  const [state, setState] = React.useState({})
  const [err, setErr] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [res, setRes] = React.useState()

  React.useEffect(() => {
    const load = async () => {
      const { transferStateId } = query
      startHeartbeat(transferStateId)

      const [err, res] = await to(browser.runtime.sendMessage({ entity: 'wallet', action: 'get-transfer-state', args: { id: transferStateId } }))
      if (err) return console.log(err)
      setState(res)
    }

    load()
  }, [])

  const confirmTransfer = React.useCallback(async () => {
    const { transferStateId } = query
    setLoading(true)
    const [err, res] = await to(browser.runtime.sendMessage({ entity: 'wallet', action: 'confirm-transfer', args: { id: transferStateId } }))
    setLoading(false)
    if (err) return setErr(err.message)
    setRes(res)
  }, [])

  const cancelTransfer = React.useCallback(async () => {
    const { transferStateId } = query
    const [err] = await to(browser.runtime.sendMessage({ entity: 'wallet', action: 'cancel-transfer', args: { id: transferStateId } }))
    if (err) return setErr(err.message)
    window.close()
  }, [])

  if (res) {
    if (res.data.error) {
      return (
        <div className="confirm-popup">
          <div className="app-title">Error</div>
          <div className="content-pad">
            <div className="break-all">{res.data.error.message}</div>
            <div className="row-buttons">
              <button className="input-button" onClick={() => window.close()}>
                close
              </button>
            </div>
          </div>
        </div>
      )
    } else {
      const txid = res.data.result.txid
      return (
        <div className="confirm-popup">
          <div className="app-title">TXID</div>
          <div className="content-pad">
            <div className="break-all">{txid}</div>
            <div className="row-buttons">
              <button className="input-button" onClick={() => window.close()}>
                close
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  const { params = {}, description = {}, sender = {} } = state

  return (
    <div className="confirm-popup">
      <div className="app-title">Confirm transfer?</div>
      <div className="content-pad">
        <div className="row-grid">
          <TransferItem title="Initiated from" value={sender.url} />
          <TransferItem title="SC ID" value={params.scid} />
          <TransferItem
            title="Transfers"
            value={params.transfers}
            render={() => {
              return params.transfers.map((transfer, index) => {
                return (
                  <div key={`transfer-${index}`} className="transfer-item">
                    <TransferItem title="SCID" value={transfer.scid} />
                    <TransferItem title="Destination" value={transfer.destination} />
                    <TransferItem title="Amount" value={transfer.amount} render={() => <FormatAsset scid={transfer.scid} value={transfer.amount} />} />
                    <TransferItem title="Burn" value={transfer.burn} render={() => <FormatAsset scid={transfer.scid} value={transfer.burn} />} />
                  </div>
                )
              })
            }}
          />
          <TransferItem
            title="SC Invocation"
            value={params.sc_rpc}
            render={() => {
              const sc_args = []
              let scid = null
              for (let i = 0; i < params.sc_rpc.length; i++) {
                const item = params.sc_rpc[i]
                if (item.name === 'SC_ID') {
                  scid = item.value
                  continue
                }

                if (item.name === 'SC_ACTION') continue
                sc_args.push(item)
              }

              return (
                <div>
                  {scid && <div>{scid}</div>}
                  <div className="sc-args">
                    <DisplayArgs args={sc_args} description={description} />
                  </div>
                </div>
              )
            }}
          />
          <TransferItem title="Ring size" value={params.ringsize} />
          <TransferItem title="Fees" value={params.fees} render={() => <FormatAsset value={params.fees} />} />
          <div className="error-bar">
            {loading && `loading...`}
            {err && (
              <div className="status-block">
                <span className="error-dot" />
                {err}
              </div>
            )}
          </div>
          <div className="row-buttons">
            <button className="input-button" onClick={cancelTransfer} disabled={loading}>
              cancel
            </button>
            <button className="input-button" onClick={confirmTransfer} disabled={loading}>
              confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
