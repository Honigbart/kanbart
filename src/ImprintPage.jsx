import legalContent from './data/legal_content.json'

function toUmlauts(value) {
  if (typeof value !== 'string') {
    return value ?? ''
  }

  return value
    .replace(/Ae/g, 'Ä')
    .replace(/Oe/g, 'Ö')
    .replace(/Ue/g, 'Ü')
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
}

function lineOrNull(value) {
  const text = toUmlauts(value).trim()
  return text.length > 0 ? text : null
}

function ImprintPage({ onNavigateHome }) {
  const meta = legalContent.meta ?? {}
  const operator = legalContent.operator ?? {}
  const registration = legalContent.registration ?? {}
  const responsiblePerson = legalContent.responsible_person ?? {}
  const disputeResolution = legalContent.dispute_resolution ?? {}

  const operatorAddressLines = [
    lineOrNull(operator.street),
    lineOrNull([operator.postal_code, operator.city].filter(Boolean).join(' ')),
    lineOrNull(operator.country),
  ].filter(Boolean)

  const responsibleAddressLines = [
    lineOrNull(responsiblePerson.street),
    lineOrNull(
      [responsiblePerson.postal_code, responsiblePerson.city].filter(Boolean).join(
        ' ',
      ),
    ),
    lineOrNull(responsiblePerson.country),
  ].filter(Boolean)

  return (
    <div className="app-shell">
      <div className="imprint-frame panel">
        <header className="imprint-header">
          <a href="/" className="imprint-back-link" onClick={onNavigateHome}>
            Back to app
          </a>
          <h1>Impressum</h1>
          {meta.service_name && (
            <p className="imprint-service-name">{toUmlauts(meta.service_name)}</p>
          )}
          {meta.authoritative_notice_de && (
            <p className="imprint-note">{toUmlauts(meta.authoritative_notice_de)}</p>
          )}
          {meta.authoritative_notice_en && (
            <p className="imprint-note">{toUmlauts(meta.authoritative_notice_en)}</p>
          )}
        </header>

        <section className="imprint-section">
          <h2>Angaben gemäß § 5 DDG</h2>
          <dl className="imprint-kv">
            {operator.company_name && (
              <>
                <dt>Name/Firma</dt>
                <dd>{toUmlauts(operator.company_name)}</dd>
              </>
            )}
            {operator.legal_form && (
              <>
                <dt>Rechtsform</dt>
                <dd>{toUmlauts(operator.legal_form)}</dd>
              </>
            )}
            {operator.representative && (
              <>
                <dt>Vertreten durch</dt>
                <dd>{toUmlauts(operator.representative)}</dd>
              </>
            )}
            {operatorAddressLines.length > 0 && (
              <>
                <dt>Anschrift</dt>
                <dd className="imprint-address">
                  {operatorAddressLines.map((line, index) => (
                    <span key={`operator-line-${index}`}>{line}</span>
                  ))}
                </dd>
              </>
            )}
            {(operator.email || operator.phone) && (
              <>
                <dt>Kontakt</dt>
                <dd className="imprint-contact">
                  {operator.email && (
                    <a href={`mailto:${operator.email}`}>{operator.email}</a>
                  )}
                  {operator.phone && <a href={`tel:${operator.phone}`}>{operator.phone}</a>}
                </dd>
              </>
            )}
            {operator.website && (
              <>
                <dt>Website</dt>
                <dd>
                  <a href={operator.website} target="_blank" rel="noreferrer">
                    {operator.website}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>

        {registration.vat_id && (
          <section className="imprint-section">
            <h2>Umsatzsteuer-ID</h2>
            <p>
              Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:{' '}
              {toUmlauts(registration.vat_id)}
            </p>
          </section>
        )}

        {(responsiblePerson.name || responsibleAddressLines.length > 0) && (
          <section className="imprint-section">
            <h2>Verantwortlich für den Inhalt</h2>
            {responsiblePerson.name && <p>{toUmlauts(responsiblePerson.name)}</p>}
            {responsibleAddressLines.length > 0 && (
              <div className="imprint-address">
                {responsibleAddressLines.map((line, index) => (
                  <span key={`responsible-line-${index}`}>{line}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {disputeResolution.consumer_arbitration_participation_de && (
          <section className="imprint-section">
            <h2>Verbraucherstreitbeilegung</h2>
            <p>{toUmlauts(disputeResolution.consumer_arbitration_participation_de)}</p>
          </section>
        )}

        <section className="imprint-section">
          <h2>English Translation</h2>
          <p className="imprint-note">
            The following section is a convenience translation. The German version above
            remains legally authoritative where permitted by law.
          </p>
        </section>

        <section className="imprint-section">
          <h2>Information according to section 5 DDG</h2>
          <dl className="imprint-kv">
            {operator.company_name && (
              <>
                <dt>Name / Company</dt>
                <dd>{toUmlauts(operator.company_name)}</dd>
              </>
            )}
            {operator.legal_form && (
              <>
                <dt>Legal form</dt>
                <dd>{toUmlauts(operator.legal_form)}</dd>
              </>
            )}
            {operator.representative && (
              <>
                <dt>Represented by</dt>
                <dd>{toUmlauts(operator.representative)}</dd>
              </>
            )}
            {operatorAddressLines.length > 0 && (
              <>
                <dt>Address</dt>
                <dd className="imprint-address">
                  {operatorAddressLines.map((line, index) => (
                    <span key={`operator-line-en-${index}`}>{line}</span>
                  ))}
                </dd>
              </>
            )}
            {(operator.email || operator.phone) && (
              <>
                <dt>Contact</dt>
                <dd className="imprint-contact">
                  {operator.email && (
                    <a href={`mailto:${operator.email}`}>{operator.email}</a>
                  )}
                  {operator.phone && <a href={`tel:${operator.phone}`}>{operator.phone}</a>}
                </dd>
              </>
            )}
            {operator.website && (
              <>
                <dt>Website</dt>
                <dd>
                  <a href={operator.website} target="_blank" rel="noreferrer">
                    {operator.website}
                  </a>
                </dd>
              </>
            )}
          </dl>
        </section>

        {registration.vat_id && (
          <section className="imprint-section">
            <h2>VAT ID</h2>
            <p>VAT identification number according to section 27a UStG: {toUmlauts(registration.vat_id)}</p>
          </section>
        )}

        {(responsiblePerson.name || responsibleAddressLines.length > 0) && (
          <section className="imprint-section">
            <h2>Responsible for content</h2>
            {responsiblePerson.name && <p>{toUmlauts(responsiblePerson.name)}</p>}
            {responsibleAddressLines.length > 0 && (
              <div className="imprint-address">
                {responsibleAddressLines.map((line, index) => (
                  <span key={`responsible-line-en-${index}`}>{line}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {disputeResolution.consumer_arbitration_participation_en && (
          <section className="imprint-section">
            <h2>Consumer dispute resolution</h2>
            <p>{toUmlauts(disputeResolution.consumer_arbitration_participation_en)}</p>
          </section>
        )}
      </div>
    </div>
  )
}

export default ImprintPage
