// everest
// Copyright (C) 2023 Percona LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { test, expect } from '@fixtures';

test.describe('Everest CLI install', async () => {
  test('install everest and db-namespaces separately', async ({ page, cli, request }) => {
    const verifyOperators = async (namespace: string, operators: string[]) => {
      await test.step('verify operators installation', async () => {
        const checkOperators = await cli.checkOperatorsInstall(namespace);
        expect(checkOperators.stdout).toContain('OLM: ');
        operators.forEach((operator) => {
          expect(checkOperators.stdout).toContain(operator);
        });
      });
    };

    const verifyEverestSystem = async () => {
      await test.step('verify everest-system namespace installation', async () => {
        const checkOperators = await cli.checkOperatorsInstall('everest-system');
        expect(checkOperators.stdout).toContain('OLM: ');
        const operators = [
          'percona-everest-operator',
          'argocd-operator',
        ];
        operators.forEach((operator) => {
          expect(checkOperators.stdout).toContain(operator);
        });
      });
    };

    const namespaces = 'ns1,ns2';

    await test.step('install everest-operator', async () => {
      const out = await cli.installEverestOperator();
      expect(out.stdout).toContain('Everest has been installed');
    });

    await verifyEverestSystem();

    await test.step('disable telemetry', async () => {
      await cli.disableTelemetry();
    });

    await test.step('install db-namespaces', async () => {
      const out = await cli.installDbNamespaces(namespaces);
      expect(out.stdout).toContain('namespaces have been configured');
    });

    await verifyOperators('ns1', [
      'percona-server-mongodb-operator',
      'percona-xtradb-cluster-operator',
      'postgresql-operator',
    ]);
    await verifyOperators('ns2', [
      'percona-server-mongodb-operator',
      'percona-xtradb-cluster-operator',
      'postgresql-operator',
    ]);

    await test.step('check namespaces lists in the UI', async () => {
      const login = await request.post('/v1/session', {
        data: {
          token: await cli.getEverestToken(),
        },
      });
      expect(login.ok()).toBeTruthy();

      await page.goto('/databases');
      await page.getByTestId('db-engines-button').click();
      await page.getByTestId('add-db-cluster-button').click();

      // Check namespaces in DB wizard
      await page.getByTestId('text-input-db-tracker-name').fill('test');
      await page.getByTestId('select-namespace-button').click();
      await expect(page.getByRole('option', { name: 'ns1' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'ns2' })).toBeVisible();
      await expect(page.getByRole('option', { name: 'everest-system' })).not.toBeVisible();
      await page.getByRole('option', { name: 'ns1' }).click();

      // Cancel DB wizard
      await page.getByTestId('close-dialog-icon').click();

      // Check namespaces in settings
      await page.getByTestId('settings-button').click();
      await page.getByTestId('settings-namespaces').click();

      await expect(page.getByText('ns1')).toBeVisible();
      await expect(page.getByText('ns2')).toBeVisible();
      await expect(page.getByText('everest-system')).not.toBeVisible();
    });
  });
});
